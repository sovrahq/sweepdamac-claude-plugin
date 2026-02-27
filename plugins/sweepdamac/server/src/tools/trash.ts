import { z } from "zod";
import { exists, dirSize, expandPath } from "../utils/scanner.js";
import { formatBytes } from "../utils/formatter.js";
import { exec, safeRm } from "../utils/executor.js";
import { join } from "node:path";
import { readdirSync } from "node:fs";

export const emptyTrashSchema = z.object({
  confirm: z.boolean().describe("Must be true to proceed with emptying trash"),
});

export async function emptyTrash(args: z.infer<typeof emptyTrashSchema>) {
  const trashPaths: { path: string; size: number }[] = [];

  // User trash
  const userTrash = expandPath("~/.Trash");
  if (exists(userTrash)) {
    trashPaths.push({ path: userTrash, size: dirSize(userTrash) });
  }

  // Volume trashes
  const volumesPath = "/Volumes";
  if (exists(volumesPath)) {
    try {
      const volumes = readdirSync(volumesPath, { withFileTypes: true });
      for (const vol of volumes) {
        const trashDir = join(volumesPath, vol.name, ".Trashes");
        if (exists(trashDir)) {
          trashPaths.push({ path: trashDir, size: dirSize(trashDir) });
        }
      }
    } catch { /* skip */ }
  }

  const totalSize = trashPaths.reduce((sum, t) => sum + t.size, 0);

  if (totalSize === 0) {
    return {
      content: [{ type: "text" as const, text: "Trash is already empty." }],
    };
  }

  if (!args.confirm) {
    return {
      content: [
        {
          type: "text" as const,
          text: `## Trash Summary\n\n**Total trash size: ${formatBytes(totalSize)}**\n\nLocations:\n${trashPaths.map((t) => `- ${t.path}: ${formatBytes(t.size)}`).join("\n")}\n\nSet \`confirm: true\` to empty all trash.`,
        },
      ],
    };
  }

  // Empty user trash
  let freed = 0;
  const errors: string[] = [];

  for (const trash of trashPaths) {
    try {
      const entries = readdirSync(trash.path);
      for (const entry of entries) {
        const full = join(trash.path, entry);
        const result = safeRm(full);
        if (result.success) {
          freed += trash.size / entries.length; // approximate per-item
        } else {
          errors.push(`${full}: ${result.error}`);
        }
      }
    } catch (err: any) {
      errors.push(`${trash.path}: ${err.message}`);
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `## Trash Emptied\n\n**Space freed: ~${formatBytes(totalSize)}**${errors.length > 0 ? `\n\n**Errors:**\n${errors.map((e) => `- ${e}`).join("\n")}` : ""}`,
      },
    ],
  };
}
