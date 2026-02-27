#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { scanSystemJunkSchema, scanSystemJunk, cleanSystemJunkSchema, cleanSystemJunk } from "./tools/system-junk.js";
import { emptyTrashSchema, emptyTrash } from "./tools/trash.js";
import { findLargeFilesSchema, findLargeFiles } from "./tools/large-files.js";
import { cleanMailSchema, cleanMail } from "./tools/mail-cleanup.js";
import { cleanPrivacySchema, cleanPrivacy } from "./tools/privacy.js";
import { runMaintenanceSchema, runMaintenance } from "./tools/maintenance.js";
import { manageLaunchAgentsSchema, manageLaunchAgents, manageLoginItemsSchema, manageLoginItems, killHungAppsSchema, killHungApps } from "./tools/optimization.js";
import { uninstallAppSchema, uninstallApp } from "./tools/uninstaller.js";
import { spaceLensSchema, spaceLens } from "./tools/space-lens.js";
import { manageExtensionsSchema, manageExtensions } from "./tools/extensions.js";
import { systemOverviewSchema, systemOverview } from "./tools/system-overview.js";

const server = new McpServer({
  name: "SweepDaMac",
  version: "1.0.0",
});

// 1. Scan System Junk
server.tool(
  "scan_system_junk",
  "Scan for system junk: caches, logs, temp files, Xcode data, broken preferences. Returns categorized list with sizes.",
  scanSystemJunkSchema.shape,
  async (args) => scanSystemJunk(args as any)
);

// 2. Clean System Junk
server.tool(
  "clean_system_junk",
  "Delete system junk by category. Requires confirm:true. Categories: user_caches, system_caches, user_logs, system_logs, diagnostic_reports, xcode_*",
  cleanSystemJunkSchema.shape,
  async (args) => cleanSystemJunk(args as any)
);

// 3. Empty Trash
server.tool(
  "empty_trash",
  "Empty all trash bins (user trash + volume trashes). Shows size before deletion. Requires confirm:true.",
  emptyTrashSchema.shape,
  async (args) => emptyTrash(args as any)
);

// 4. Find Large Files
server.tool(
  "find_large_files",
  "Find large and old files on disk. Configurable min size (MB), age (days), and path.",
  findLargeFilesSchema.shape,
  async (args) => findLargeFiles(args as any)
);

// 5. Clean Mail
server.tool(
  "clean_mail",
  "Scan/clean Mail.app attachments and downloads. Use action:'scan' to preview, action:'clean' with confirm:true to delete.",
  cleanMailSchema.shape,
  async (args) => cleanMail(args as any)
);

// 6. Clean Privacy
server.tool(
  "clean_privacy",
  "Clean browser privacy data: cache, history, cookies, autofill. Supports Safari, Chrome, Firefox, Brave.",
  cleanPrivacySchema.shape,
  async (args) => cleanPrivacy(args as any)
);

// 7. Run Maintenance
server.tool(
  "run_maintenance",
  "Run macOS maintenance tasks: flush DNS, free RAM, periodic scripts, rebuild Spotlight, repair permissions, rebuild Launch Services, speed up Mail, thin Time Machine.",
  runMaintenanceSchema.shape,
  async (args) => runMaintenance(args as any)
);

// 8. Manage Launch Agents
server.tool(
  "manage_launch_agents",
  "List, enable, or disable launch agents (background services). Shows user and system agents.",
  manageLaunchAgentsSchema.shape,
  async (args) => manageLaunchAgents(args as any)
);

// 9. Manage Login Items
server.tool(
  "manage_login_items",
  "List and remove login items (apps that start at login).",
  manageLoginItemsSchema.shape,
  async (args) => manageLoginItems(args as any)
);

// 10. Kill Hung Apps
server.tool(
  "kill_hung_apps",
  "Detect and force-quit unresponsive/hung applications.",
  killHungAppsSchema.shape,
  async (args) => killHungApps(args as any)
);

// 11. Uninstall App
server.tool(
  "uninstall_app",
  "Completely uninstall an app and all its related files (preferences, caches, support files). Use action:'scan' to preview, action:'uninstall' with confirm:true to delete.",
  uninstallAppSchema.shape,
  async (args) => uninstallApp(args as any)
);

// 12. Space Lens
server.tool(
  "space_lens",
  "Analyze disk usage with a tree view of directories sorted by size. Configurable path and depth.",
  spaceLensSchema.shape,
  async (args) => spaceLens(args as any)
);

// 13. Manage Extensions
server.tool(
  "manage_extensions",
  "List and manage system extensions: Safari extensions, Preference Panes, Spotlight/Internet/QuickLook plugins.",
  manageExtensionsSchema.shape,
  async (args) => manageExtensions(args as any)
);

// 14. System Overview
server.tool(
  "system_overview",
  "Complete system status: disk space, RAM, CPU, top processes, macOS version, uptime.",
  systemOverviewSchema.shape,
  async () => systemOverview()
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SweepDaMac MCP server running on stdio");
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
