import { execSync } from "node:child_process";

export interface ExecResult {
  success: boolean;
  output: string;
  error?: string;
}

export function exec(
  command: string,
  opts: { timeout?: number; sudo?: boolean } = {}
): ExecResult {
  const timeout = opts.timeout ?? 30_000;
  const cmd = opts.sudo ? `sudo ${command}` : command;

  try {
    const output = execSync(cmd, {
      timeout,
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output: output.trim() };
  } catch (err: any) {
    return {
      success: false,
      output: err.stdout?.toString().trim() ?? "",
      error: err.stderr?.toString().trim() ?? err.message,
    };
  }
}

export function safeRm(path: string): ExecResult {
  // Never allow deleting system-critical paths
  const forbidden = ["/System", "/usr", "/bin", "/sbin", "/private/var/db"];
  for (const f of forbidden) {
    if (path.startsWith(f)) {
      return {
        success: false,
        output: "",
        error: `Refusing to delete protected path: ${path}`,
      };
    }
  }
  return exec(`rm -rf ${JSON.stringify(path)}`);
}

export function safeRmFiles(paths: string[]): {
  deleted: string[];
  failed: string[];
  totalFreed: number;
} {
  const deleted: string[] = [];
  const failed: string[] = [];
  let totalFreed = 0;

  for (const p of paths) {
    try {
      const { statSync } = require("node:fs");
      const stat = statSync(p);
      const size = stat.isDirectory()
        ? parseInt(
            exec(`du -sk ${JSON.stringify(p)}`).output.split("\t")[0] || "0"
          ) * 1024
        : stat.size;

      const result = safeRm(p);
      if (result.success) {
        deleted.push(p);
        totalFreed += size;
      } else {
        failed.push(p);
      }
    } catch {
      const result = safeRm(p);
      if (result.success) deleted.push(p);
      else failed.push(p);
    }
  }

  return { deleted, failed, totalFreed };
}
