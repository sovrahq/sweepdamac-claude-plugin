import { z } from "zod";
import { exists, expandPath, dirSize } from "../utils/scanner.js";
import { formatBytes } from "../utils/formatter.js";
import { safeRm } from "../utils/executor.js";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const extensionLocations: Record<string, string[]> = {
  safari_extensions: [
    "~/Library/Safari/Extensions",
    "~/Library/Containers/com.apple.Safari/Data/Library/Safari/Extensions",
  ],
  preference_panes: [
    "~/Library/PreferencePanes",
    "/Library/PreferencePanes",
  ],
  spotlight_plugins: [
    "~/Library/Spotlight",
    "/Library/Spotlight",
  ],
  internet_plugins: [
    "~/Library/Internet Plug-Ins",
    "/Library/Internet Plug-Ins",
  ],
  quicklook_plugins: [
    "~/Library/QuickLook",
    "/Library/QuickLook",
  ],
};

export const manageExtensionsSchema = z.object({
  action: z.enum(["list", "delete"]).default("list"),
  category: z.enum(["safari_extensions", "preference_panes", "spotlight_plugins", "internet_plugins", "quicklook_plugins", "all"]).default("all"),
  name: z.string().optional().describe("Extension name to delete (for delete action)"),
  confirm: z.boolean().default(false),
});

interface ExtensionInfo {
  name: string;
  path: string;
  size: number;
  category: string;
}

function listExtensions(categories: string[]): ExtensionInfo[] {
  const results: ExtensionInfo[] = [];

  for (const cat of categories) {
    const dirs = extensionLocations[cat];
    if (!dirs) continue;

    for (const dir of dirs) {
      const resolved = expandPath(dir);
      if (!exists(resolved)) continue;

      try {
        const entries = readdirSync(resolved);
        for (const entry of entries) {
          if (entry.startsWith(".")) continue;
          const full = join(resolved, entry);
          try {
            const stat = statSync(full);
            const size = stat.isDirectory() ? dirSize(full) : stat.size;
            results.push({ name: entry, path: full, size, category: cat });
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  }

  return results;
}

export async function manageExtensions(args: z.infer<typeof manageExtensionsSchema>) {
  const categories = args.category === "all"
    ? Object.keys(extensionLocations)
    : [args.category];

  const extensions = listExtensions(categories);

  if (args.action === "list") {
    if (extensions.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No extensions found." }],
      };
    }

    // Group by category
    const grouped = new Map<string, ExtensionInfo[]>();
    for (const ext of extensions) {
      const list = grouped.get(ext.category) ?? [];
      list.push(ext);
      grouped.set(ext.category, list);
    }

    let text = "## System Extensions\n\n";
    for (const [cat, exts] of grouped) {
      text += `### ${cat.replace(/_/g, " ")}\n`;
      for (const ext of exts) {
        text += `- **${ext.name}** — ${formatBytes(ext.size)} (\`${ext.path}\`)\n`;
      }
      text += "\n";
    }

    text += `Use \`action: "delete", name: "ExtensionName", confirm: true\` to remove an extension.`;

    return { content: [{ type: "text" as const, text }] };
  }

  // Delete
  if (!args.name) {
    return {
      content: [{ type: "text" as const, text: "Please specify the `name` of the extension to delete." }],
    };
  }

  const target = extensions.find(
    (e) => e.name.toLowerCase() === args.name!.toLowerCase()
  );

  if (!target) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Extension not found: **${args.name}**. Use \`action: "list"\` to see available extensions.`,
        },
      ],
    };
  }

  if (!args.confirm) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Will delete: **${target.name}** (${formatBytes(target.size)}) at \`${target.path}\`\n\nSet \`confirm: true\` to proceed.`,
        },
      ],
    };
  }

  const result = safeRm(target.path);
  return {
    content: [
      {
        type: "text" as const,
        text: result.success
          ? `Deleted extension: **${target.name}** — freed ${formatBytes(target.size)}`
          : `Failed to delete: ${result.error}`,
      },
    ],
  };
}
