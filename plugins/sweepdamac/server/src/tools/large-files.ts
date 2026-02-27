import { z } from "zod";
import { scanDirectory, expandPath } from "../utils/scanner.js";
import { formatBytes, formatDate, markdownTable } from "../utils/formatter.js";

export const findLargeFilesSchema = z.object({
  min_size_mb: z.number().default(100).describe("Minimum file size in MB"),
  older_than_days: z.number().default(90).describe("Only show files older than N days (by last access)"),
  path: z.string().default("~").describe("Directory to scan"),
  limit: z.number().default(50).describe("Max number of results"),
});

export async function findLargeFiles(args: z.infer<typeof findLargeFilesSchema>) {
  const results = scanDirectory(args.path, {
    minSizeMb: args.min_size_mb,
    olderThanDays: args.older_than_days,
    maxDepth: 5,
  });

  results.sort((a, b) => b.size - a.size);
  const limited = results.slice(0, args.limit);

  if (limited.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `No files found larger than ${args.min_size_mb} MB and older than ${args.older_than_days} days in ${args.path}.`,
        },
      ],
    };
  }

  const totalSize = limited.reduce((sum, f) => sum + f.size, 0);
  const basePath = expandPath(args.path);

  const rows = limited.map((f) => [
    f.path.replace(basePath, "~"),
    formatBytes(f.size),
    formatDate(f.lastAccessed),
    f.isDirectory ? "dir" : "file",
  ]);

  const table = markdownTable(["Path", "Size", "Last Accessed", "Type"], rows);

  return {
    content: [
      {
        type: "text" as const,
        text: `## Large Files Found\n\n**${limited.length} items** totaling **${formatBytes(totalSize)}**\n\n${table}`,
      },
    ],
  };
}
