import {
  normalizeServerConfig,
  readClaudeCodeConfig,
  readClaudeDesktopConfig,
  readMcpRegistry,
  writeClaudeCodeConfig,
  writeClaudeDesktopConfig,
  writeMcpRegistry,
} from "./config.ts";
import {
  CheckboxOption,
  ClientSelectOption,
  ClientState,
  ClientType,
  McpRegistry,
  NestedCheckboxGroup,
} from "./types.ts";

export const autoImportServers = async (): Promise<McpRegistry> => {
  const registry = await readMcpRegistry();
  const claudeCodeConfig = await readClaudeCodeConfig();
  const claudeDesktopConfig = await readClaudeDesktopConfig();

  let hasChanges = false;

  for (const [name, config] of Object.entries(claudeCodeConfig.mcpServers)) {
    if (!registry.mcpServers[name]) {
      const normalized = normalizeServerConfig(config);
      if (normalized) {
        registry.mcpServers[name] = normalized;
        hasChanges = true;
        console.log(`📥 Imported server '${name}' from Claude Code`);
      }
    }
  }

  for (const [name, config] of Object.entries(claudeDesktopConfig.mcpServers)) {
    if (!registry.mcpServers[name]) {
      const normalized = normalizeServerConfig({ type: "stdio", ...config });
      if (normalized) {
        registry.mcpServers[name] = normalized;
        hasChanges = true;
        console.log(`📥 Imported server '${name}' from Claude Desktop`);
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
