export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function markdownTable(
  headers: string[],
  rows: string[][]
): string {
  const sep = headers.map(() => "---");
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${sep.join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ];
  return lines.join("\n");
}

export function treeLine(
  name: string,
  size: string,
  depth: number,
  isLast: boolean
): string {
  const prefix = depth === 0 ? "" : "  ".repeat(depth - 1) + (isLast ? "└── " : "├── ");
  return `${prefix}${name} (${size})`;
}
