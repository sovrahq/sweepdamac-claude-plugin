# SweepDaMac

Sweep Da Mac clean — right from Claude Code. System junk, caches, old files, privacy traces, app leftovers, and more. 14 tools + 1 skill to keep your Mac in top shape using natural language.

## Installation

### As a Claude Code Plugin (recommended)

**Step 1** — Add the marketplace:

```
/plugin marketplace add sovrahq/sweepdamac-claude-plugin
```

**Step 2** — Install the plugin:

```
/plugin install sweepdamac@sweepdamac-marketplace
```

**Step 3** — Build the MCP server (one time):

```bash
./setup.sh
```

**Step 4** — Restart Claude Code. Done!

### Manual install (alternative)

```bash
git clone https://github.com/sovrahq/sweepdamac-claude-plugin.git
cd sweepdamac-claude-plugin
./setup.sh
```

Then add to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "sweepdamac": {
      "command": "node",
      "args": ["/absolute/path/to/sweepdamac-claude-plugin/server/dist/index.js"]
    }
  }
}
```

## Quick Start

Run `/sweep` for a full system checkup, or just talk naturally:

```
> /sweep
> Sweep da Mac for junk files
> How much space can I free up?
> Uninstall Slack completely
> Show me my system overview
```

## Features

### 14 MCP Tools

| Tool | What it does |
|------|-------------|
| `scan_system_junk` | Scan caches, logs, temp files, Xcode data |
| `clean_system_junk` | Sweep away system junk by category |
| `empty_trash` | Empty all trash bins |
| `find_large_files` | Find large and old files hogging space |
| `clean_mail` | Sweep Mail.app attachments/downloads |
| `clean_privacy` | Sweep browser data (Safari, Chrome, Firefox, Brave) |
| `run_maintenance` | Flush DNS, free RAM, rebuild Spotlight, and more |
| `manage_launch_agents` | List/enable/disable background services |
| `manage_login_items` | List/remove login items |
| `kill_hung_apps` | Detect and force-quit hung apps |
| `uninstall_app` | Completely uninstall apps with all related files |
| `space_lens` | Disk usage tree view |
| `manage_extensions` | Manage Safari/Spotlight/QuickLook extensions |
| `system_overview` | Full system status report |

### Skill: `/sweep`

Runs a full system checkup: system overview + junk scan + large files scan, then gives you a summary with recommended actions.

## Safety

- All destructive operations require explicit `confirm: true`
- Scan/preview mode is always the default
- System-protected paths (SIP) are never touched
- The uninstaller shows all files before deleting anything

## Requirements

- macOS
- Node.js 18+
- Claude Code CLI

## For the team

Once the repo is on GitHub, teammates just need to run:

```
/plugin marketplace add sovrahq/sweepdamac-claude-plugin
/plugin install sweepdamac@sweepdamac-marketplace
```

Then `./setup.sh` and restart Claude Code. That's it.

## License

MIT
