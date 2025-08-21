export interface McpStdioServerConfig {
  type?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpSSEServerConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

export interface McpHttpServerConfig {
  type: "http";
  url: string;
  headers?: Record<string, string>;
}

export type McpServerConfig =
  | McpStdioServerConfig
  | McpSSEServerConfig
  | McpHttpServerConfig;

export interface McpRegistry {
  mcpServers: Record<string, McpServerConfig>;
}

export interface ClaudeCodeConfig {
  mcpServers: Record<string, McpServerConfig>;
  [key: string]: unknown;
}

export interface ClaudeDesktopConfig {
  mcpServers: Record<string, Omit<McpStdioServerConfig, "type">>;
  [key: string]: unknown;
}

export interface CheckboxOption {
  value: string;
  name: string;
  checked: boolean;
}

export interface NestedCheckboxGroup {
  name: string;
  options: CheckboxOption[];
}

export interface ClientState {
  claudeCode: Record<string, boolean>;
  claudeDesktop: Record<string, boolean>;
}

export type ClientType = "claudeCode" | "claudeDesktop";

export interface ClientSelectOption {
  name: string;
  value: ClientType;
}
