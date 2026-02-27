import { z } from "zod";
import { exists, expandPath } from "../utils/scanner.js";
import { exec } from "../utils/executor.js";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// --- Launch Agents ---

export const manageLaunchAgentsSchema = z.object({
  action: z.enum(["list", "disable", "enable"]).default("list"),
  label: z.string().optional().describe("Launch agent label (for enable/disable)"),
});

interface LaunchAgentInfo {
  label: string;
  path: string;
  enabled: boolean;
  program: string;
}

function parsePlist(path: string): Record<string, any> {
  try {
    const result = exec(`plutil -convert json -o - ${JSON.stringify(path)}`);
    if (result.success) return JSON.parse(result.output);
  } catch { /* skip */ }
  return {};
}

function listAgents(dir: string): LaunchAgentInfo[] {
  const resolved = expandPath(dir);
  if (!exists(resolved)) return [];
  const agents: LaunchAgentInfo[] = [];

  try {
    const files = readdirSync(resolved).filter((f) => f.endsWith(".plist"));
    for (const file of files) {
      const full = join(resolved, file);
      const plist = parsePlist(full);
      const label = plist.Label || file.replace(".plist", "");
      const program = plist.Program || plist.ProgramArguments?.[0] || "unknown";

      // Check if disabled
      const disabled = plist.Disabled === true;

      agents.push({ label, path: full, enabled: !disabled, program });
    }
  } catch { /* skip */ }

  return agents;
}

export async function manageLaunchAgents(args: z.infer<typeof manageLaunchAgentsSchema>) {
  if (args.action === "list") {
    const userAgents = listAgents("~/Library/LaunchAgents");
    const systemAgents = listAgents("/Library/LaunchAgents");

    const format = (agents: LaunchAgentInfo[], section: string) => {
      if (agents.length === 0) return `### ${section}\nNo agents found.\n`;
      const lines = agents.map(
        (a) => `- ${a.enabled ? "🟢" : "🔴"} **${a.label}** → \`${a.program}\``
      );
      return `### ${section}\n${lines.join("\n")}\n`;
    };

    return {
      content: [
        {
          type: "text" as const,
          text: `## Launch Agents\n\n${format(userAgents, "User Agents")}${format(systemAgents, "System Agents")}\nUse \`action: "disable", label: "com.example.agent"\` to disable an agent.`,
        },
      ],
    };
  }

  if (!args.label) {
    return {
      content: [{ type: "text" as const, text: "Please specify a `label` for the agent to enable/disable." }],
    };
  }

  if (args.action === "disable") {
    const result = exec(`launchctl bootout gui/$(id -u) ${JSON.stringify(args.label)} 2>/dev/null; launchctl disable gui/$(id -u)/${args.label}`);
    return {
      content: [
        {
          type: "text" as const,
          text: result.success
            ? `Disabled launch agent: **${args.label}**`
            : `Failed to disable: ${result.error}`,
        },
      ],
    };
  }

  // enable
  const result = exec(`launchctl enable gui/$(id -u)/${args.label}`);
  return {
    content: [
      {
        type: "text" as const,
        text: result.success
          ? `Enabled launch agent: **${args.label}**`
          : `Failed to enable: ${result.error}`,
      },
    ],
  };
}

// --- Login Items ---

export const manageLoginItemsSchema = z.object({
  action: z.enum(["list", "remove"]).default("list"),
  name: z.string().optional().describe("App name to remove from login items"),
});

export async function manageLoginItems(args: z.infer<typeof manageLoginItemsSchema>) {
  if (args.action === "list") {
    const result = exec(`osascript -e 'tell application "System Events" to get the name of every login item'`);

    if (!result.success) {
      return {
        content: [{ type: "text" as const, text: `Could not list login items: ${result.error}` }],
      };
    }

    const items = result.output.split(", ").filter(Boolean);
    if (items.length === 0) {
      return { content: [{ type: "text" as const, text: "No login items found." }] };
    }

    const lines = items.map((i) => `- ${i}`);
    return {
      content: [
        {
          type: "text" as const,
          text: `## Login Items\n\n${lines.join("\n")}\n\nUse \`action: "remove", name: "AppName"\` to remove an item.`,
        },
      ],
    };
  }

  if (!args.name) {
    return {
      content: [{ type: "text" as const, text: "Please specify the `name` of the login item to remove." }],
    };
  }

  const result = exec(
    `osascript -e 'tell application "System Events" to delete login item "${args.name}"'`
  );

  return {
    content: [
      {
        type: "text" as const,
        text: result.success
          ? `Removed login item: **${args.name}**`
          : `Failed to remove: ${result.error}`,
      },
    ],
  };
}

// --- Kill Hung Apps ---

export const killHungAppsSchema = z.object({
  force: z.boolean().default(false).describe("Force kill all not-responding apps"),
});

export async function killHungApps(args: z.infer<typeof killHungAppsSchema>) {
  // Use AppleScript to find not responding apps
  const result = exec(
    `osascript -e 'tell application "System Events" to set hungApps to (name of every application process whose background only is false and frontmost is false)' 2>/dev/null`
  );

  // Alternative: check with lsappinfo
  const spinResult = exec(`lsappinfo list | grep -B2 '"Not Responding"' | grep "name=" | sed 's/.*name="\\(.*\\)".*/\\1/'`);

  const hungApps = spinResult.output.split("\n").filter(Boolean);

  if (hungApps.length === 0) {
    return {
      content: [{ type: "text" as const, text: "No hung/unresponsive apps detected." }],
    };
  }

  if (!args.force) {
    return {
      content: [
        {
          type: "text" as const,
          text: `## Hung Apps Detected\n\n${hungApps.map((a) => `- ${a}`).join("\n")}\n\nSet \`force: true\` to force quit these apps.`,
        },
      ],
    };
  }

  const results: string[] = [];
  for (const app of hungApps) {
    const killResult = exec(`killall -9 ${JSON.stringify(app)}`);
    results.push(
      killResult.success ? `✅ Killed: ${app}` : `❌ Failed: ${app} — ${killResult.error}`
    );
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `## Force Quit Results\n\n${results.join("\n")}`,
      },
    ],
  };
}
