import { z } from "zod";
import { exists, expandPath, dirSize } from "../utils/scanner.js";
import { formatBytes } from "../utils/formatter.js";
import { exec, safeRmFiles } from "../utils/executor.js";
import { join } from "node:path";
import { readdirSync, statSync } from "node:fs";

export const uninstallAppSchema = z.object({
  app_name: z.string().describe("Name of the app to uninstall (e.g., 'Slack')"),
  action: z.enum(["scan", "uninstall"]).default("scan"),
  confirm: z.boolean().default(false),
});

function findBundleId(appName: string): string | null {
  // Try to find bundle ID from the .app
  const locations = ["/Applications", expandPath("~/Applications")];
  for (const loc of locations) {
    const appPath = join(loc, `${appName}.app`);
    if (exists(appPath)) {
      const result = exec(`mdls -name kMDItemCFBundleIdentifier -raw ${JSON.stringify(appPath)}`);
      if (result.success && result.output && result.output !== "(null)") {
        return result.output.trim();
      }
      // Fallback: read Info.plist
      const plistPath = join(appPath, "Contents/Info.plist");
      if (exists(plistPath)) {
        const result2 = exec(`/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" ${JSON.stringify(plistPath)}`);
        if (result2.success) return result2.output.trim();
      }
    }
  }
  return null;
}

function findRelatedFiles(appName: string, bundleId: string | null): { path: string; size: number }[] {
  const found: { path: string; size: number }[] = [];
  const h = expandPath("~");

  // The app itself
  const appLocations = [
    `/Applications/${appName}.app`,
    `${h}/Applications/${appName}.app`,
  ];

  // Directories to search for bundle ID or app name patterns
  const searchDirs = [
    `${h}/Library/Application Support`,
    `${h}/Library/Caches`,
    `${h}/Library/Preferences`,
    `${h}/Library/Logs`,
    `${h}/Library/Containers`,
    `${h}/Library/Group Containers`,
    `${h}/Library/HTTPStorages`,
    `${h}/Library/WebKit`,
    `${h}/Library/Saved Application State`,
    `${h}/Library/Cookies`,
    `${h}/Library/LaunchAgents`,
    `/Library/Application Support`,
    `/Library/Caches`,
    `/Library/LaunchAgents`,
    `/Library/LaunchDaemons`,
    `/Library/Preferences`,
    `/Library/PrivilegedHelperTools`,
    `/Library/Logs`,
  ];

  // Check app bundles
  for (const appPath of appLocations) {
    if (exists(appPath)) {
      found.push({ path: appPath, size: dirSize(appPath) });
    }
  }

  // Search patterns
  const patterns: string[] = [appName.toLowerCase()];
  if (bundleId) {
    patterns.push(bundleId.toLowerCase());
    // Also try the reversed domain parts
    const parts = bundleId.split(".");
    if (parts.length >= 2) {
      patterns.push(parts.slice(-1)[0].toLowerCase());
    }
  }

  for (const dir of searchDirs) {
    if (!exists(dir)) continue;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const entryLower = entry.toLowerCase();
        const matches = patterns.some((p) => entryLower.includes(p));
        if (matches) {
          const full = join(dir, entry);
          try {
            const stat = statSync(full);
            const size = stat.isDirectory() ? dirSize(full) : stat.size;
            found.push({ path: full, size });
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }

  // Deduplicate
  const seen = new Set<string>();
  return found.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });
}

export async function uninstallApp(args: z.infer<typeof uninstallAppSchema>) {
  const bundleId = findBundleId(args.app_name);
  const files = findRelatedFiles(args.app_name, bundleId);

  if (files.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `No files found for app: **${args.app_name}**. Make sure the name matches exactly (e.g., "Slack", "Visual Studio Code").`,
        },
      ],
    };
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  if (args.action === "scan" || !args.confirm) {
    const lines = files.map((f) => `- \`${f.path}\` — ${formatBytes(f.size)}`);

    return {
      content: [
        {
          type: "text" as const,
          text: `## Uninstall Scan: ${args.app_name}\n\n${bundleId ? `**Bundle ID**: ${bundleId}\n` : ""}**Total: ${formatBytes(totalSize)}** (${files.length} items)\n\n${lines.join("\n")}\n\n⚠️ Review carefully before proceeding. Use \`action: "uninstall", confirm: true\` to delete all listed files.`,
        },
      ],
    };
  }

  // Close the app first
  exec(`osascript -e 'tell application "${args.app_name}" to quit' 2>/dev/null`);
  exec(`killall ${JSON.stringify(args.app_name)} 2>/dev/null`);

  // Wait briefly for app to close
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const result = safeRmFiles(files.map((f) => f.path));

  return {
    content: [
      {
        type: "text" as const,
        text: `## Uninstall Complete: ${args.app_name}\n\n- Deleted: ${result.deleted.length} items\n- Failed: ${result.failed.length} items\n- Space freed: ${formatBytes(result.totalFreed)}${result.failed.length > 0 ? `\n\n**Failed:**\n${result.failed.map((f) => `- ${f}`).join("\n")}` : ""}`,
      },
    ],
  };
}
