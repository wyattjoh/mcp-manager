# MCP Manager

A CLI tool to manage MCP (Model Context Protocol) server configurations across Claude Code and Claude Desktop applications using an interactive nested checkbox interface.

## Features

- **Auto-Discovery**: Automatically discovers MCP servers from existing Claude configurations
- **Interactive Management**: Nested checkbox interface for toggling servers across multiple clients
- **Cross-Platform**: Manages both Claude Code (`~/.claude.json`) and Claude Desktop configs
- **Registry System**: Maintains a master registry of all known MCP server configurations
- **Non-Destructive**: Only modifies MCP server sections, preserves other configuration properties
- **Type Safety**: Handles different server types (stdio, http, sse) with appropriate client compatibility

## Installation

### From JSR (Recommended)

```bash
# Install globally
deno install -gA jsr:@wyattjoh/mcp-manager@0.2.0

# Run directly without installation
deno run -A jsr:@wyattjoh/mcp-manager@0.2.0
```

### From Source

```bash
# Clone the repository
git clone https://github.com/wyattjoh/mcp-manager.git
cd mcp-manager

# Make executable
chmod +x main.ts

# Run directly
./main.ts
```

## Usage

### Interactive Mode (Default)

Launch the interactive checkbox interface to manage MCP servers:

```bash
mcp-manager
```

This presents a nested menu where you can:

- Toggle individual servers on/off for each client
- See current enabled/disabled status
- Apply changes across multiple configurations simultaneously

### Command Line Options

```bash
# Show all MCP servers and their status
mcp-manager list

# Sync/import servers from existing client configs
mcp-manager sync

# Initialize or update the MCP registry
mcp-manager init

# Show help
mcp-manager --help
```

## How It Works

### Architecture Overview

1. **Auto-Discovery**: Scans existing Claude configurations for MCP servers
2. **Registry Management**: Maintains master registry at `~/.mcp.json`
3. **State Resolution**: Determines enabled/disabled state from client configs
4. **Interactive Selection**: Provides UI for toggling servers per client
5. **Config Updates**: Applies selections by updating client configuration files

### Configuration Files

- `~/.mcp.json` - Master registry (created/managed by this tool)
- `~/.claude.json` - Claude Code configuration
- `~/Library/Application Support/Claude/claude_desktop_config.json` - Claude Desktop configuration (macOS)

### Key Design Decisions

- **Registry as Single Source**: `~/.mcp.json` stores complete server configurations but NOT enabled/disabled state
- **Client Configs as Truth**: Enabled status determined by presence in client config files
- **Auto-Import**: New servers found in client configs are automatically imported to registry
- **Type Safety**: Different server types with Claude Desktop only supporting stdio servers

## Server Type Compatibility

| Server Type | Claude Code | Claude Desktop |
| ----------- | ----------- | -------------- |
| stdio       | ✅          | ✅             |
| http        | ✅          | ❌             |
| sse         | ✅          | ❌             |

> **Note**: HTTP and SSE servers cannot be used with Claude Desktop. The tool will warn and skip these during configuration.

## Example Workflow

1. **Initialize**: Run `mcp-manager init` to discover existing servers
2. **Manage**: Use `mcp-manager` (interactive mode) to toggle servers
3. **Monitor**: Use `mcp-manager list` to check current status
4. **Sync**: Run `mcp-manager sync` to import newly added servers

## Development

```bash
# Clone the repository
git clone https://github.com/wyattjoh/mcp-manager.git
cd mcp-manager

# Run in development mode with file watching
deno task dev

# Format code
deno fmt

# Type check
deno check .

# Lint code
deno lint
```

## Permissions

The tool requires the following Deno permissions:

- `--allow-read` - Read configuration files
- `--allow-write` - Write updated configurations
- `--allow-env=HOME` - Access home directory path

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the existing code style
4. Run `deno fmt`, `deno check .`, and `deno lint`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
