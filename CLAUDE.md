# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Deno CLI tool that manages MCP (Model Context Protocol) server configurations across Claude Code and Claude Desktop applications using an interactive nested checkbox interface.

## Development Commands

```bash
# Run the CLI tool interactively (main usage)
deno task start
# or directly: ./main.ts

# Run in development mode with file watching
deno task dev

# Show help and available commands
deno task start --help

# List current MCP server status
deno task start list

# Import/sync servers from existing configs
deno task start sync

# Initialize the MCP registry
deno task start init

# Code quality commands (run after editing files)
deno fmt        # Format code
deno check .    # Type check
deno lint       # Lint code
```

## Architecture

The codebase follows a functional programming approach with clear separation of concerns:

**Core Data Flow:**

1. **Auto-Discovery**: Scans `~/.claude.json` and `~/Library/Application Support/Claude/claude_desktop_config.json` for MCP servers
2. **Registry Management**: Maintains master registry at `~/.mcp.json` with all known server configurations
3. **State Resolution**: Reads current enabled/disabled state from client configs (not stored in registry)
4. **Interactive Selection**: Presents nested checkbox UI for toggling servers per client
5. **Config Updates**: Applies selections by updating client configuration files

**Module Structure:**

- **`lib/types.ts`**: TypeScript interfaces for MCP server configs, client configs, and UI components
- **`lib/config.ts`**: File I/O operations and JSON parsing for all configuration files
- **`lib/mcp.ts`**: Core business logic for server discovery, state management, and configuration updates
- **`lib/interactive.ts`**: Cliffy-based interactive UI implementation
- **`main.ts`**: CLI entry point using Cliffy Command framework

**Key Design Decisions:**

- **Registry as Single Source**: `~/.mcp.json` stores complete server configurations but NOT enabled/disabled state
- **Client Configs as Truth**: Enabled status is determined by presence in client config files
- **Auto-Import**: New servers found in client configs are automatically imported to registry
- **Type Safety**: Different server types (stdio, http, sse) with Claude Desktop only supporting stdio
- **Non-destructive**: Only modifies `mcpServers` sections, preserves other config properties

## Important Implementation Details

- Claude Desktop config format omits the `type` field (assumes stdio), while Claude Code includes it
- HTTP/SSE servers cannot be used with Claude Desktop - the tool warns and skips them
- All file operations use `@std/fs` with proper error handling and file creation
- Interactive mode uses Cliffy's nested checkbox feature for simultaneous multi-client management
- Permissions required: `--allow-read --allow-write --allow-env` (for HOME directory access)

## Configuration Files

- `~/.mcp.json`: Master registry (created/managed by this tool)
- `~/.claude.json`: Claude Code configuration (read and modified)
- `~/Library/Application Support/Claude/claude_desktop_config.json`: Claude Desktop config (read and modified)
