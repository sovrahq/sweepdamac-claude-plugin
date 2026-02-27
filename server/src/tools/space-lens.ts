import { z } from "zod";
import { expandPath, listSubdirs } from "../utils/scanner.js";
import { formatBytes, treeLine } from "../utils/formatter.js";

export const spaceLensSchema = z.object({
  path: z.string().default("~").describe("Directory to analyze"),
  depth: z.number().default(2).describe("How many levels deep to scan (1-4)"),
  limit: z.number().default(15).describe("Max items per level"),
});

function buildTree(
  dir: string,
  depth: number,
  maxDepth: number,
  limit: number
): string[] {
  const lines: string[] = [];
  const items = listSubdirs(dir).slice(0, limit);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLast = i === items.length - 1;
    lines.push(treeLine(item.name, formatBytes(item.size), depth, isLast));

    if (depth < maxDepth && item.size > 0) {
      const subItems = listSubdirs(`${dir}/${item.name}`).slice(0, Math.max(5, limit - 5));
      for (let j = 0; j < subItems.length; j++) {
        const sub = subItems[j];
        const subIsLast = j === subItems.length - 1;
        lines.push(treeLine(sub.name, formatBytes(sub.size), depth + 1, subIsLast));
      }
    }
  }

  return lines;
}

export async function spaceLens(args: z.infer<typeof spaceLensSchema>) {
  const resolved = expandPath(args.path);
  const clampedDepth = Math.min(Math.max(args.depth, 1), 4);

  const tree = buildTree(resolved, 0, clampedDepth, args.limit);

  // Get total size of path
  const { exec } = await import("../utils/executor.js");
  const duResult = exec(`du -sk ${JSON.stringify(resolved)} 2>/dev/null`);
  const totalKb = parseInt(duResult.output.split("\t")[0] || "0");
  const totalSize = totalKb * 1024;

  return {
    content: [
      {
        type: "text" as const,
        text: `## Space Lens: ${args.path}\n\n**Total size: ${formatBytes(totalSize)}**\n\n\`\`\`\n${tree.join("\n")}\n\`\`\``,
      },
    ],
  };
}
