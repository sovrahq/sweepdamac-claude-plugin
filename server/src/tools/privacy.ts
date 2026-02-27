import { z } from "zod";
import { exists, expandPath, dirSize } from "../utils/scanner.js";
import { formatBytes } from "../utils/formatter.js";
import { safeRm, safeRmFiles } from "../utils/executor.js";

const browserPaths: Record<string, Record<string, string>> = {
  safari: {
    cache: "~/Library/Caches/com.apple.Safari",
    history: "~/Library/Safari/History.db",
    cookies: "~/Library/Cookies/Cookies.binarycookies",
    downloads: "~/Library/Safari/Downloads.plist",
  },
  chrome: {
    cache: "~/Library/Caches/Google/Chrome",
    history: "~/Library/Application Support/Google/Chrome/Default/History",
    cookies: "~/Library/Application Support/Google/Chrome/Default/Cookies",
    autofill: "~/Library/Application Support/Google/Chrome/Default/Web Data",
  },
  firefox: {
    cache: "~/Library/Caches/Firefox",
    history: "~/Library/Application Support/Firefox/Profiles",
  },
  brave: {
    cache: "~/Library/Caches/BraveSoftware/Brave-Browser",
    history: "~/Library/Application Support/BraveSoftware/Brave-Browser/Default/History",
    cookies: "~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies",
  },
};

const systemPrivacy: Record<string, string> = {
  recent_items: "~/Library/Application Support/com.apple.sharedfilelist",
  finder_recents: "~/Library/Preferences/com.apple.finder.plist",
};

export const cleanPrivacySchema = z.object({
  browsers: z.array(z.enum(["safari", "chrome", "firefox", "brave"])).default(["safari", "chrome"]).describe("Browsers to clean"),
  categories: z.array(z.enum(["cache", "history", "cookies", "downloads", "autofill", "recent_items"])).default(["cache"]).describe("Data categories to clean"),
  action: z.enum(["scan", "clean"]).default("scan"),
  confirm: z.boolean().default(false),
});

export async function cleanPrivacy(args: z.infer<typeof cleanPrivacySchema>) {
  const found: { browser: string; category: string; path: string; size: number }[] = [];

  for (const browser of args.browsers) {
    const paths = browserPaths[browser];
    if (!paths) continue;

    for (const category of args.categories) {
      const rawPath = paths[category];
      if (!rawPath) continue;
      const resolved = expandPath(rawPath);
      if (!exists(resolved)) continue;

      const { statSync } = require("node:fs");
      try {
        const stat = statSync(resolved);
        const size = stat.isDirectory() ? dirSize(resolved) : stat.size;
        if (size > 0) {
          found.push({ browser, category, path: resolved, size });
        }
      } catch { /* skip */ }
    }
  }

  // System privacy items
  if (args.categories.includes("recent_items")) {
    for (const [key, rawPath] of Object.entries(systemPrivacy)) {
      const resolved = expandPath(rawPath);
      if (!exists(resolved)) continue;
      try {
        const { statSync } = require("node:fs");
        const stat = statSync(resolved);
        const size = stat.isDirectory() ? dirSize(resolved) : stat.size;
        found.push({ browser: "system", category: key, path: resolved, size });
      } catch { /* skip */ }
    }
  }

  const totalSize = found.reduce((sum, f) => sum + f.size, 0);

  if (found.length === 0) {
    return {
      content: [{ type: "text" as const, text: "No privacy data found for the specified browsers and categories." }],
    };
  }

  if (args.action === "scan" || !args.confirm) {
    const lines = found.map(
      (f) => `- **${f.browser}** → ${f.category}: ${formatBytes(f.size)} (\`${f.path}\`)`
    );

    return {
      content: [
        {
          type: "text" as const,
          text: `## Privacy Scan\n\n**Total: ${formatBytes(totalSize)}**\n\n${lines.join("\n")}\n\n⚠️ Cleaning cookies will log you out of websites. Use \`action: "clean", confirm: true\` to proceed.`,
        },
      ],
    };
  }

  const result = safeRmFiles(found.map((f) => f.path));

  return {
    content: [
      {
        type: "text" as const,
        text: `## Privacy Cleanup Complete\n\n- Deleted: ${result.deleted.length} items\n- Space freed: ${formatBytes(result.totalFreed)}${result.failed.length > 0 ? `\n- Failed: ${result.failed.length}` : ""}`,
      },
    ],
  };
}
