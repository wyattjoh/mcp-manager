import { Confirm, Select } from "@cliffy/prompt";
import {
  normalizeServerConfig,
  readClaudeCodeConfig,
  readClaudeDesktopConfig,
  readMcpRegistry,
  serverConfigsEqual,
  writeClaudeCodeConfig,
  writeClaudeDesktopConfig,
  writeMcpRegistry,
} from "./config.ts";
import {
  CheckboxOption,
  ClientSelectOption,
  ClientState,
  ClientType,
  ConfigConflict,
  McpRegistry,
  McpServerConfig,
  McpStdioServerConfig,
  NestedCheckboxGroup,
} from "./types.ts";

export const autoImportServers = async (): Promise<McpRegistry> => {
  const registry = await readMcpRegistry();
  const claudeCodeConfig = await readClaudeCodeConfig();
  const claudeDesktopConfig = await readClaudeDesktopConfig();

  const conflicts: ConfigConflict[] = [];
  let hasChanges = false;

  for (const [name, config] of Object.entries(claudeCodeConfig.mcpServers)) {
    const normalized = normalizeServerConfig(config);
    if (!normalized) continue;

    if (!registry.mcpServers[name]) {
      registry.mcpServers[name] = normalized;
      hasChanges = true;
      console.log(`📥 Imported server '${name}' from Claude Code`);
    } else if (!serverConfigsEqual(registry.mcpServers[name], normalized)) {
      conflicts.push({
        serverName: name,
        registryConfig: registry.mcpServers[name],
        clientConfig: normalized,
        clientSource: "claudeCode",
      });
    }
  }

  for (const [name, config] of Object.entries(claudeDesktopConfig.mcpServers)) {
    const normalized = normalizeServerConfig({ type: "stdio", ...config });
    if (!normalized) continue;

    if (!registry.mcpServers[name]) {
      registry.mcpServers[name] = normalized;
      hasChanges = true;
      console.log(`📥 Imported server '${name}' from Claude Desktop`);
    } else if (!serverConfigsEqual(registry.mcpServers[name], normalized)) {
      const existingConflict = conflicts.find((c) => c.serverName === name);
      if (!existingConflict) {
        conflicts.push({
          serverName: name,
          registryConfig: registry.mcpServers[name],
          clientConfig: normalized,
          clientSource: "claudeDesktop",
        });
      }
    }
  }

  if (conflicts.length > 0) {
    const resolvedChanges = await resolveConflicts(conflicts);
    for (const { serverName, config } of resolvedChanges) {
      registry.mcpServers[serverName] = config;
      hasChanges = true;
    }

    if (resolvedChanges.length > 0) {
      console.log(
        `\n🔄 ${resolvedChanges.length} conflict${
          resolvedChanges.length > 1 ? "s" : ""
        } resolved in registry.`,
      );

      const shouldSync = await Confirm.prompt({
        message: "Update all clients with the resolved configurations?",
        default: true,
      });

      if (shouldSync) {
        console.log("\n📝 Updating all clients...");
        await syncAllClientsWithRegistry(registry);
        console.log("💡 Restart Claude applications to apply changes.");
      } else {
        console.log(
          "⏭️  Skipped client updates. Use interactive mode to configure clients.",
        );
      }
    }
  }

  if (hasChanges) {
    await writeMcpRegistry(registry);
    console.log(
      `✅ Updated registry with ${
        Object.keys(registry.mcpServers).length
      } servers`,
    );
  }

  return registry;
};

export const getCurrentState = async (): Promise<ClientState> => {
  const claudeCodeConfig = await readClaudeCodeConfig();
  const claudeDesktopConfig = await readClaudeDesktopConfig();

  return {
    claudeCode: Object.keys(claudeCodeConfig.mcpServers).reduce(
      (acc, name) => {
        acc[name] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    ),
    claudeDesktop: Object.keys(claudeDesktopConfig.mcpServers).reduce(
      (acc, name) => {
        acc[name] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    ),
  };
};

export const buildCheckboxOptions = (
  registry: McpRegistry,
  currentState: ClientState,
): NestedCheckboxGroup[] => {
  const serverNames = Object.keys(registry.mcpServers).sort();

  return [
    {
      name: "Claude Code",
      options: serverNames.map((name) => ({
        value: `code:${name}`,
        name,
        checked: currentState.claudeCode[name] || false,
      })),
    },
    {
      name: "Claude Desktop",
      options: serverNames.map((name) => ({
        value: `desktop:${name}`,
        name,
        checked: currentState.claudeDesktop[name] || false,
      })),
    },
  ];
};

export const clients = {
  claudeCode: "Claude Code",
  claudeDesktop: "Claude Desktop",
};

export const buildClientSelectOptions = (): ClientSelectOption[] => {
  return Object.entries(clients).map(([key, value]) => ({
    name: value,
    value: key as ClientType,
  }));
};

export const filterServersByClient = (
  registry: McpRegistry,
  clientType: ClientType,
): Record<string, boolean> => {
  const filtered: Record<string, boolean> = {};

  for (const [name, config] of Object.entries(registry.mcpServers)) {
    if (clientType === "claudeDesktop") {
      if (config.type === "http" || config.type === "sse") {
        continue;
      }
    }
    filtered[name] = true;
  }

  return filtered;
};

export const buildClientCheckboxOptions = (
  registry: McpRegistry,
  currentState: ClientState,
  clientType: ClientType,
): CheckboxOption[] => {
  const availableServers = filterServersByClient(registry, clientType);
  const serverNames = Object.keys(availableServers).sort();

  return serverNames.map((name) => ({
    value: name,
    name,
    checked: currentState[clientType][name] || false,
  }));
};

export const parseSelections = (
  selections: string[],
): { code: Set<string>; desktop: Set<string> } => {
  const code = new Set<string>();
  const desktop = new Set<string>();

  for (const selection of selections) {
    if (selection.startsWith("code:")) {
      code.add(selection.slice(5));
    } else if (selection.startsWith("desktop:")) {
      desktop.add(selection.slice(8));
    }
  }

  return { code, desktop };
};

export const syncAllClientsWithRegistry = async (
  registry: McpRegistry,
): Promise<void> => {
  const claudeCodeConfig = await readClaudeCodeConfig();
  const claudeDesktopConfig = await readClaudeDesktopConfig();

  // Get current enabled state before clearing configs
  const currentState = await getCurrentState();

  const newClaudeCodeServers: Record<string, McpServerConfig> = {};
  const newClaudeDesktopServers: Record<
    string,
    Omit<McpStdioServerConfig, "type">
  > = {};

  let codeCount = 0;
  let desktopCount = 0;
  let skippedCount = 0;

  // Only sync servers that are currently enabled in each client
  for (const [serverName, config] of Object.entries(registry.mcpServers)) {
    if (currentState.claudeCode[serverName]) {
      newClaudeCodeServers[serverName] = config;
      codeCount++;
    }

    if (currentState.claudeDesktop[serverName]) {
      if (config.type === "http" || config.type === "sse") {
        console.warn(
          `⚠️  Skipping '${serverName}' for Claude Desktop: ${config.type} servers not supported`,
        );
        skippedCount++;
      } else {
        const { type: _type, ...desktopConfig } = config;
        newClaudeDesktopServers[serverName] = desktopConfig;
        desktopCount++;
      }
    }
  }

  claudeCodeConfig.mcpServers = newClaudeCodeServers;
  claudeDesktopConfig.mcpServers = newClaudeDesktopServers;

  await Promise.all([
    writeClaudeCodeConfig(claudeCodeConfig),
    writeClaudeDesktopConfig(claudeDesktopConfig),
  ]);

  console.log(
    `✅ Updated client configurations: Claude Code (${codeCount}), Claude Desktop (${desktopCount})${
      skippedCount > 0 ? `, ${skippedCount} skipped` : ""
    }`,
  );
};

export const applySelections = async (
  registry: McpRegistry,
  selections: { code: Set<string>; desktop: Set<string> },
): Promise<void> => {
  const claudeCodeConfig = await readClaudeCodeConfig();
  const claudeDesktopConfig = await readClaudeDesktopConfig();

  claudeCodeConfig.mcpServers = {};
  claudeDesktopConfig.mcpServers = {};

  for (const serverName of selections.code) {
    const config = registry.mcpServers[serverName];
    if (config) {
      claudeCodeConfig.mcpServers[serverName] = config;
    }
  }

  for (const serverName of selections.desktop) {
    const config = registry.mcpServers[serverName];
    if (config) {
      if (config.type === "http" || config.type === "sse") {
        console.warn(
          `⚠️  Skipping '${serverName}' for Claude Desktop: ${config.type} servers not supported`,
        );
      } else {
        const { type: _type, ...desktopConfig } = config;
        claudeDesktopConfig.mcpServers[serverName] = desktopConfig;
      }
    }
  }

  await Promise.all([
    writeClaudeCodeConfig(claudeCodeConfig),
    writeClaudeDesktopConfig(claudeDesktopConfig),
  ]);
};

export const applyClientSelections = async (
  registry: McpRegistry,
  clientType: ClientType,
  selectedServers: string[],
): Promise<void> => {
  if (clientType === "claudeCode") {
    const claudeCodeConfig = await readClaudeCodeConfig();
    claudeCodeConfig.mcpServers = {};

    for (const serverName of selectedServers) {
      const config = registry.mcpServers[serverName];
      if (config) {
        claudeCodeConfig.mcpServers[serverName] = config;
      }
    }

    await writeClaudeCodeConfig(claudeCodeConfig);
  } else {
    const claudeDesktopConfig = await readClaudeDesktopConfig();
    claudeDesktopConfig.mcpServers = {};

    for (const serverName of selectedServers) {
      const config = registry.mcpServers[serverName];
      if (config) {
        if (config.type === "http" || config.type === "sse") {
          console.warn(
            `⚠️  Skipping '${serverName}' for Claude Desktop: ${config.type} servers not supported`,
          );
        } else {
          const { type: _type, ...desktopConfig } = config;
          claudeDesktopConfig.mcpServers[serverName] = desktopConfig;
        }
      }
    }

    await writeClaudeDesktopConfig(claudeDesktopConfig);
  }
};

export const listServers = async (): Promise<void> => {
  const registry = await readMcpRegistry();
  const currentState = await getCurrentState();

  console.log("🔧 MCP Server Status\n");

  if (Object.keys(registry.mcpServers).length === 0) {
    console.log("No MCP servers found. Run with no arguments to initialize.");
    return;
  }

  const serverNames = Object.keys(registry.mcpServers).sort();
  const maxNameLength = Math.max(...serverNames.map((name) => name.length));

  for (const name of serverNames) {
    const codeStatus = currentState.claudeCode[name] ? "✅" : "❌";
    const desktopStatus = currentState.claudeDesktop[name] ? "✅" : "❌";
    const paddedName = name.padEnd(maxNameLength);

    console.log(
      `  ${paddedName} │ Code: ${codeStatus} │ Desktop: ${desktopStatus}`,
    );
  }

  console.log(
    `\n📊 Total: ${serverNames.length} servers │ Registry: ~/.mcp.json`,
  );
};

export const resolveConflicts = async (
  conflicts: ConfigConflict[],
): Promise<{ serverName: string; config: McpServerConfig }[]> => {
  const resolvedChanges: { serverName: string; config: McpServerConfig }[] = [];

  for (const conflict of conflicts) {
    console.log(
      `\n⚠️  Configuration mismatch detected for '${conflict.serverName}'\n`,
    );

    console.log("Registry Version:");
    console.log(formatConfig(conflict.registryConfig));

    console.log(
      `\n${
        conflict.clientSource === "claudeCode"
          ? "Claude Code"
          : "Claude Desktop"
      } Version:`,
    );
    console.log(formatConfig(conflict.clientConfig));

    const choice = await Select.prompt({
      message: "Which version would you like to keep?",
      options: [
        { name: "Keep Registry Version", value: "registry" },
        {
          name: `Use ${
            conflict.clientSource === "claudeCode"
              ? "Claude Code"
              : "Claude Desktop"
          } Version`,
          value: "client",
        },
        { name: "Skip (keep registry unchanged)", value: "skip" },
      ],
    });

    if (choice === "client") {
      resolvedChanges.push({
        serverName: conflict.serverName,
        config: conflict.clientConfig,
      });
      console.log(
        `✅ Will update registry with ${
          conflict.clientSource === "claudeCode"
            ? "Claude Code"
            : "Claude Desktop"
        } version`,
      );
    } else if (choice === "registry") {
      console.log("✅ Keeping registry version");
    } else {
      console.log("⏭️  Skipped");
    }
  }

  return resolvedChanges;
};

const formatConfig = (config: McpServerConfig): string => {
  const lines: string[] = [];

  lines.push(`  Type: ${config.type || "stdio"}`);

  if (config.type === "http" || config.type === "sse") {
    lines.push(`  URL: ${config.url}`);
    if (config.headers && Object.keys(config.headers).length > 0) {
      lines.push("  Headers:");
      for (const [key, value] of Object.entries(config.headers)) {
        lines.push(`    ${key}: ${value}`);
      }
    }
  } else {
    lines.push(`  Command: ${config.command}`);
    if (config.args && config.args.length > 0) {
      lines.push("  Args:");
      for (const arg of config.args) {
        lines.push(`    - ${arg}`);
      }
    }
    if (config.env && Object.keys(config.env).length > 0) {
      lines.push("  Environment:");
      for (const [key, value] of Object.entries(config.env)) {
        lines.push(`    ${key}: ${value}`);
      }
    }
  }

  return lines.join("\n");
};
