#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env

import { Command } from "@cliffy/command";
import { runInteractiveMode } from "./lib/interactive.ts";
import { autoImportServers, listServers } from "./lib/mcp.ts";

const main = new Command()
  .name("mcp-manager")
  .version("0.1.0")
  .description(
    "CLI tool to manage MCP server configurations across Claude Code and Claude Desktop",
  )
  .action(async () => {
    await runInteractiveMode();
  });

main
  .command("list", "Show all MCP servers and their current status")
  .action(async () => {
    await listServers();
  });

main
  .command("sync", "Sync and import servers from client configurations")
  .action(async () => {
    console.log("🔄 Syncing MCP server configurations...\n");
    await autoImportServers();
    console.log("\n✅ Sync completed!");
  });

main
  .command("init", "Initialize or update the MCP registry")
  .action(async () => {
    console.log("🚀 Initializing MCP registry...\n");
    await autoImportServers();
    console.log("\n✅ Registry initialized!");
  });

if (import.meta.main) {
  try {
    await main.parse(Deno.args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error:", message);
    Deno.exit(1);
  }
}
