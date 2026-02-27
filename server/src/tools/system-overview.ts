import { z } from "zod";
import { exec } from "../utils/executor.js";
import { formatBytes } from "../utils/formatter.js";

export const systemOverviewSchema = z.object({});

export async function systemOverview() {
  const sections: string[] = ["## System Overview\n"];

  // macOS version
  const osVersion = exec("sw_vers -productVersion");
  const osBuild = exec("sw_vers -buildVersion");
  const hostname = exec("hostname");
  sections.push(`**macOS**: ${osVersion.output} (${osBuild.output})`);
  sections.push(`**Host**: ${hostname.output}`);

  // Uptime
  const uptime = exec("uptime");
  sections.push(`**Uptime**: ${uptime.output.trim()}`);

  // CPU
  const cpuBrand = exec("sysctl -n machdep.cpu.brand_string");
  sections.push(`**CPU**: ${cpuBrand.output}`);

  // Disk space
  const df = exec("df -H / | tail -1");
  if (df.success) {
    const parts = df.output.split(/\s+/);
    // filesystem size used avail capacity
    if (parts.length >= 5) {
      sections.push(`\n### Disk Space (/)`);
      sections.push(`- Total: ${parts[1]}`);
      sections.push(`- Used: ${parts[2]}`);
      sections.push(`- Available: ${parts[3]}`);
      sections.push(`- Usage: ${parts[4]}`);
    }
  }

  // Purgeable space
  const purgeable = exec(`diskutil info / | grep "Purgeable"`);
  if (purgeable.success && purgeable.output) {
    sections.push(`- Purgeable: ${purgeable.output.split(":").pop()?.trim()}`);
  }

  // RAM
  const totalMem = exec("sysctl -n hw.memsize");
  if (totalMem.success) {
    const totalBytes = parseInt(totalMem.output);
    sections.push(`\n### Memory`);
    sections.push(`- Total RAM: ${formatBytes(totalBytes)}`);

    // Memory pressure
    const pressure = exec("memory_pressure 2>/dev/null | head -1");
    if (pressure.success && pressure.output) {
      sections.push(`- Pressure: ${pressure.output}`);
    }

    // vm_stat for more details
    const vmstat = exec("vm_stat");
    if (vmstat.success) {
      const pageSize = 16384; // Apple Silicon default
      const lines = vmstat.output.split("\n");
      const extract = (label: string): number => {
        const line = lines.find((l) => l.includes(label));
        if (!line) return 0;
        const match = line.match(/(\d+)/);
        return match ? parseInt(match[1]) * pageSize : 0;
      };
      const free = extract("free");
      const active = extract("active");
      const inactive = extract("inactive");
      const wired = extract("wired");

      sections.push(`- Active: ${formatBytes(active)}`);
      sections.push(`- Inactive: ${formatBytes(inactive)}`);
      sections.push(`- Wired: ${formatBytes(wired)}`);
      sections.push(`- Free: ${formatBytes(free)}`);
    }
  }

  // Top 5 by CPU
  const topCpu = exec("ps aux --sort=-%cpu | head -6");
  if (topCpu.success) {
    sections.push(`\n### Top 5 Processes by CPU`);
    sections.push("```");
    sections.push(topCpu.output);
    sections.push("```");
  }

  // Top 5 by Memory
  const topMem = exec("ps aux --sort=-%mem | head -6");
  if (topMem.success) {
    sections.push(`\n### Top 5 Processes by Memory`);
    sections.push("```");
    sections.push(topMem.output);
    sections.push("```");
  }

  return {
    content: [{ type: "text" as const, text: sections.join("\n") }],
  };
}
