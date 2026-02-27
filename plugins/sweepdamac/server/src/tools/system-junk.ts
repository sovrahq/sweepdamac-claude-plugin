import { z } from "zod";
import { home, scanDirectory, exists, dirSize, expandPath } from "../utils/scanner.js";
import { formatBytes, markdownTable } from "../utils/formatter.js";
import { safeRmFiles } from "../utils/executor.js";
import { join } from "node:path";

export const scanSystemJunkSchema = z.object({
  include_xcode: z.boolean().default(false).describe("Include Xcode derived data, archives, device support"),
  include_broken_prefs: z.boolean().default(false).describe("Include broken preference files"),
});

interface JunkItem {
  path: string;
  size: number;
  category: string;
}

function scanCategory(dir: string, category: string): JunkItem[] {
  const resolved = expandPath(dir);
  if (!exists(resolved)) return [];
  const items: JunkItem[] = [];
  try {
    const { readdirSync } = require("node:fs");
    const entries = readdirSync(resolved, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(resolved, entry.name);
      try {
        const size = entry.isDirectory() ? dirSize(full) : require("node:fs").statSync(full).size;
        if (size > 0) {
          items.push({ path: full, size, category });
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return items;
}

export async function scanSystemJunk(args: z.infer<typeof scanSystemJunkSchema>) {
  const allItems: JunkItem[] = [];

  // User caches
  allItems.push(...scanCategory("~/Library/Caches", "user_caches"));

  // System caches
  allItems.push(...scanCategory("/Library/Caches", "system_caches"));

  // User logs
  allItems.push(...scanCategory("~/Library/Logs", "user_logs"));

  // System logs
  allItems.push(...scanCategory("/var/log", "system_logs"));

  // Diagnostic reports
  allItems.push(...scanCategory("~/Library/Logs/DiagnosticReports", "diagnostic_reports"));

  // Xcode
  if (args.include_xcode) {
    const xcodeLocations = [
      { path: "~/Library/Developer/Xcode/DerivedData", cat: "xcode_derived_data" },
      { path: "~/Library/Developer/Xcode/Archives", cat: "xcode_archives" },
      { path: "~/Library/Developer/Xcode/iOS DeviceSupport", cat: "xcode_device_support" },
      { path: "~/Library/Developer/CoreSimulator/Caches", cat: "xcode_simulator_caches" },
    ];
    for (const loc of xcodeLocations) {
      allItems.push(...scanCategory(loc.path, loc.cat));
    }
  }

  // Broken preferences
  if (args.include_broken_prefs) {
    const prefsDir = expandPath("~/Library/Preferences");
    if (exists(prefsDir)) {
      try {
        const { readdirSync, statSync } = require("node:fs");
        const entries = readdirSync(prefsDir);
        for (const name of entries) {
          if (name.endsWith(".plist")) {
            const full = join(prefsDir, name);
            try {
              const { execSync } = require("node:child_process");
              execSync(`plutil -lint ${JSON.stringify(full)}`, { stdio: "pipe" });
            } catch {
              const size = statSync(full).size;
              allItems.push({ path: full, size, category: "broken_preferences" });
            }
          }
        }
      } catch { /* skip */ }
    }
  }

  const totalSize = allItems.reduce((sum, i) => sum + i.size, 0);

  // Group by category
  const byCategory = new Map<string, { count: number; size: number }>();
  for (const item of allItems) {
    const existing = byCategory.get(item.category) ?? { count: 0, size: 0 };
    existing.count++;
    existing.size += item.size;
    byCategory.set(item.category, existing);
  }

  const rows = [...byCategory.entries()].map(([cat, info]) => [
    cat,
    String(info.count),
    formatBytes(info.size),
  ]);

  const table = markdownTable(["Category", "Items", "Size"], rows);

  return {
    content: [
      {
        type: "text" as const,
        text: `## System Junk Scan Results\n\n**Total junk found: ${formatBytes(totalSize)}** (${allItems.length} items)\n\n${table}\n\nUse \`clean_system_junk\` to remove specific categories.`,
      },
    ],
    _data: allItems,
  };
}

export const cleanSystemJunkSchema = z.object({
  categories: z.array(z.string()).describe("Categories to clean: user_caches, system_caches, user_logs, system_logs, diagnostic_reports, xcode_derived_data, xcode_archives, xcode_device_support, xcode_simulator_caches, broken_preferences"),
  confirm: z.boolean().describe("Must be true to proceed with deletion"),
});

export async function cleanSystemJunk(args: z.infer<typeof cleanSystemJunkSchema>) {
  if (!args.confirm) {
    return {
      content: [{ type: "text" as const, text: "Aborted. Set `confirm: true` to proceed with deletion." }],
    };
  }

  // Re-scan to get current items
  const scan = await scanSystemJunk({ include_xcode: true, include_broken_prefs: true });
  const items = (scan as any)._data as JunkItem[];
  const toDelete = items.filter((i) => args.categories.includes(i.category));

  if (toDelete.length === 0) {
    return {
      content: [{ type: "text" as const, text: "No items found for the specified categories." }],
    };
  }

  const result = safeRmFiles(toDelete.map((i) => i.path));

  return {
    content: [
      {
        type: "text" as const,
        text: `## Cleanup Results\n\n- **Deleted**: ${result.deleted.length} items\n- **Failed**: ${result.failed.length} items\n- **Space freed**: ${formatBytes(result.totalFreed)}${result.failed.length > 0 ? `\n\n**Failed items:**\n${result.failed.map((f) => `- ${f}`).join("\n")}` : ""}`,
      },
    ],
  };
}
