import { z } from "zod";
import { exists, dirSize, expandPath, scanDirectory } from "../utils/scanner.js";
import { formatBytes, markdownTable } from "../utils/formatter.js";
import { safeRmFiles } from "../utils/executor.js";

export const cleanMailSchema = z.object({
  action: z.enum(["scan", "clean"]).default("scan").describe("scan to preview, clean to delete"),
  confirm: z.boolean().default(false).describe("Must be true when action is clean"),
});

export async function cleanMail(args: z.infer<typeof cleanMailSchema>) {
  const locations = [
    { path: "~/Library/Mail Downloads", label: "Mail Downloads" },
    { path: "~/Library/Containers/com.apple.mail/Data/Library/Mail Downloads", label: "Mail Downloads (Container)" },
  ];

  const items: { path: string; size: number; label: string }[] = [];

  for (const loc of locations) {
    const resolved = expandPath(loc.path);
    if (!exists(resolved)) continue;
    const size = dirSize(resolved);
    if (size > 0) {
      items.push({ path: resolved, size, label: loc.label });
    }
  }

  // Scan for attachment files in Mail library
  const mailLib = expandPath("~/Library/Mail");
  if (exists(mailLib)) {
    const attachments = scanDirectory(mailLib, { maxDepth: 6 }).filter(
      (f) => !f.isDirectory && f.size > 1024 * 1024 // > 1MB attachments
    );
    const totalAttachSize = attachments.reduce((sum, a) => sum + a.size, 0);
    if (totalAttachSize > 0) {
      items.push({ path: mailLib + " (attachments)", size: totalAttachSize, label: "Mail Attachments (>1MB)" });
    }
  }

  const totalSize = items.reduce((sum, i) => sum + i.size, 0);

  if (totalSize === 0) {
    return {
      content: [{ type: "text" as const, text: "No mail attachments or downloads found to clean." }],
    };
  }

  if (args.action === "scan" || !args.confirm) {
    const rows = items.map((i) => [i.label, formatBytes(i.size), i.path]);
    const table = markdownTable(["Location", "Size", "Path"], rows);

    return {
      content: [
        {
          type: "text" as const,
          text: `## Mail Cleanup Scan\n\n**Total: ${formatBytes(totalSize)}**\n\n${table}\n\nUse \`action: "clean", confirm: true\` to delete Mail Downloads.`,
        },
      ],
    };
  }

  // Only clean download directories, not mail library itself
  const toClean = items.filter((i) => !i.path.includes("(attachments)")).map((i) => i.path);
  const result = safeRmFiles(toClean);

  return {
    content: [
      {
        type: "text" as const,
        text: `## Mail Cleanup Complete\n\n- Deleted: ${result.deleted.length} locations\n- Space freed: ${formatBytes(result.totalFreed)}`,
      },
    ],
  };
}
