import { z } from "zod";
import { exec } from "../utils/executor.js";

const tasks: Record<string, { label: string; command: string; sudo: boolean; description: string }> = {
  flush_dns: {
    label: "Flush DNS Cache",
    command: "dscacheutil -flushcache && killall -HUP mDNSResponder",
    sudo: true,
    description: "Clear DNS cache to resolve connectivity issues",
  },
  free_ram: {
    label: "Free RAM (purge)",
    command: "purge",
    sudo: true,
    description: "Free up inactive memory",
  },
  run_periodic: {
    label: "Run Periodic Scripts",
    command: "periodic daily weekly monthly",
    sudo: true,
    description: "Run macOS daily/weekly/monthly maintenance scripts",
  },
  rebuild_spotlight: {
    label: "Rebuild Spotlight Index",
    command: "mdutil -E /",
    sudo: true,
    description: "Rebuild Spotlight search index",
  },
  repair_permissions: {
    label: "Repair Disk Permissions",
    command: `diskutil resetUserPermissions / $(id -u)`,
    sudo: false,
    description: "Reset user permissions on boot volume",
  },
  rebuild_launch_services: {
    label: "Rebuild Launch Services DB",
    command: "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user",
    sudo: false,
    description: "Rebuild the Launch Services database (fixes 'Open With' menu)",
  },
  speed_up_mail: {
    label: "Speed Up Mail.app",
    command: 'rm -f ~/Library/Mail/V*/MailData/Envelope\\ Index*',
    sudo: false,
    description: "Remove Mail Envelope Index to force rebuild",
  },
  thin_time_machine: {
    label: "Thin Time Machine Snapshots",
    command: "tmutil thinlocalsnapshots / 10000000000 4",
    sudo: true,
    description: "Remove local Time Machine snapshots to free space",
  },
};

export const runMaintenanceSchema = z.object({
  tasks: z.array(z.string()).default(["all"]).describe("Tasks to run: flush_dns, free_ram, run_periodic, rebuild_spotlight, repair_permissions, rebuild_launch_services, speed_up_mail, thin_time_machine, all"),
  confirm: z.boolean().describe("Must be true to execute maintenance tasks"),
});

export async function runMaintenance(args: z.infer<typeof runMaintenanceSchema>) {
  const taskKeys = args.tasks.includes("all") ? Object.keys(tasks) : args.tasks;

  // Validate task names
  const invalid = taskKeys.filter((t) => !tasks[t]);
  if (invalid.length > 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Invalid tasks: ${invalid.join(", ")}\n\nAvailable: ${Object.keys(tasks).join(", ")}`,
        },
      ],
    };
  }

  if (!args.confirm) {
    const lines = taskKeys.map((t) => {
      const task = tasks[t];
      return `- **${task.label}** ${task.sudo ? "(requires sudo)" : ""}: ${task.description}`;
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `## Maintenance Tasks\n\nThe following tasks will be executed:\n\n${lines.join("\n")}\n\nSet \`confirm: true\` to proceed.`,
        },
      ],
    };
  }

  const results: { task: string; success: boolean; output: string }[] = [];

  for (const key of taskKeys) {
    const task = tasks[key];
    const result = exec(task.command, { sudo: task.sudo, timeout: 60_000 });
    results.push({
      task: task.label,
      success: result.success,
      output: result.success ? (result.output || "Done") : (result.error || "Failed"),
    });
  }

  const lines = results.map(
    (r) => `- ${r.success ? "✅" : "❌"} **${r.task}**: ${r.output.slice(0, 200)}`
  );

  return {
    content: [
      {
        type: "text" as const,
        text: `## Maintenance Results\n\n${lines.join("\n")}`,
      },
    ],
  };
}
