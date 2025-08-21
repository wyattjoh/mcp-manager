import { join } from "@std/path";
import { ensureFile, exists } from "@std/fs";
import {
  ClaudeCodeConfig,
  ClaudeDesktopConfig,
  McpRegistry,
  McpServerConfig,
} from "./types.ts";

const HOME_DIR = Deno.env.get("HOME") || "";

export const CONFIG_PATHS = {
  registry: join(HOME_DIR, ".mcp.json"),
  claudeCode: join(HOME_DIR, ".claude.json"),
  claudeDesktop: join(
    HOME_DIR,
    "Library/Application Support/Claude/claude_desktop_config.json",
  ),
};

export const readJsonFile = async <T>(
  path: string,
  defaultValue: T,
): Promise<T> => {
  try {
    if (!(await exists(path))) {
      return defaultValue;
    }
    const content = await Deno.readTextFile(path);
    return JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: Could not read ${path}:`, message);
    return defaultValue;
  }
};

export const writeJsonFile = async <T>(
  path: string,
  data: T,
): Promise<void> => {
  try {
    await ensureFile(path);
    await Deno.writeTextFile(path, JSON.stringify(data, null, 2) + "\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write ${path}: ${message}`);
  }
};

export const readMcpRegistry = async (): Promise<McpRegistry> => {
  return await readJsonFile(CONFIG_PATHS.registry, { mcpServers: {} });
};

export const writeMcpRegistry = async (
  registry: McpRegistry,
): Promise<void> => {
  await writeJsonFile(CONFIG_PATHS.registry, registry);
};

export const readClaudeCodeConfig = async (): Promise<ClaudeCodeConfig> => {
  const config = await readJsonFile(CONFIG_PATHS.claudeCode, {});
  return {
    mcpServers: {},
    ...config,
  };
};

export const writeClaudeCodeConfig = async (
  config: ClaudeCodeConfig,
): Promise<void> => {
  await writeJsonFile(CONFIG_PATHS.claudeCode, config);
};

export const readClaudeDesktopConfig = async (): Promise<
  ClaudeDesktopConfig
> => {
  return await readJsonFile(CONFIG_PATHS.claudeDesktop, { mcpServers: {} });
};

export const writeClaudeDesktopConfig = async (
  config: ClaudeDesktopConfig,
): Promise<void> => {
  await writeJsonFile(CONFIG_PATHS.claudeDesktop, config);
};

export const normalizeServerConfig = (
  config: unknown,
): McpServerConfig | null => {
  if (typeof config !== "object" || config === null) {
    return null;
  }

  const obj = config as Record<string, unknown>;

  if (obj.type === "http" && typeof obj.url === "string") {
    const config: McpServerConfig = {
      type: "http",
      url: obj.url,
    };
    if (typeof obj.headers === "object" && obj.headers !== null) {
      config.headers = obj.headers as Record<string, string>;
    }
    return config;
  }

  if (obj.type === "sse" && typeof obj.url === "string") {
    const config: McpServerConfig = {
      type: "sse",
      url: obj.url,
    };
    if (typeof obj.headers === "object" && obj.headers !== null) {
      config.headers = obj.headers as Record<string, string>;
    }
    return config;
  }

  if (typeof obj.command === "string") {
    const config: McpServerConfig = {
      type: "stdio",
      command: obj.command,
    };
    if (Array.isArray(obj.args)) {
      config.args = obj.args.filter((arg) => typeof arg === "string");
    }
    if (typeof obj.env === "object" && obj.env !== null) {
      config.env = obj.env as Record<string, string>;
    }
    return config;
  }

  return null;
};
