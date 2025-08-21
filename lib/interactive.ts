import { Checkbox, Select } from "@cliffy/prompt";
import {
  applyClientSelections,
  autoImportServers,
  buildClientCheckboxOptions,
  buildClientSelectOptions,
  getCurrentState,
} from "./mcp.ts";
import { ClientType } from "./types.ts";

export const runInteractiveMode = async (): Promise<void> => {
  console.log("🔧 MCP Server Manager\n");
  console.log("Scanning configurations...");

  const registry = await autoImportServers();
  const currentState = await getCurrentState();

  if (Object.keys(registry.mcpServers).length === 0) {
    console.log("❌ No MCP servers found in any configuration.");
    console.log(
      "Add servers to Claude Code or Claude Desktop first, then run this tool again.",
    );
    return;
  }

  console.log(
    `✅ Found ${Object.keys(registry.mcpServers).length} servers in registry\n`,
  );

  try {
    const clientOptions = buildClientSelectOptions();
    const selectedClient = await Select.prompt<ClientType>({
      message: "Which client do you want to configure?",
      options: clientOptions,
    }) as ClientType;

    const checkboxOptions = buildClientCheckboxOptions(
      registry,
      currentState,
      selectedClient,
    );

    if (checkboxOptions.length === 0) {
      const clientName = selectedClient === "claudeCode"
        ? "Claude Code"
        : "Claude Desktop";
      console.log(`❌ No compatible MCP servers found for ${clientName}.`);
      if (selectedClient === "claudeDesktop") {
        console.log("Note: Claude Desktop only supports stdio servers.");
      }
      return;
    }

    const clientName = selectedClient === "claudeCode"
      ? "Claude Code"
      : "Claude Desktop";
    const selections = await Checkbox.prompt({
      message: `Select MCP servers to enable for ${clientName}:`,
      options: checkboxOptions,
      hint: "Space to toggle, Enter to apply changes, Ctrl+C to cancel",
    });

    console.log("\n📝 Applying changes...");
    await applyClientSelections(registry, selectedClient, selections);

    console.log(`✅ Configuration updated!`);
    console.log(`   ${clientName}: ${selections.length} servers enabled`);

    if (selections.length > 0) {
      console.log(`\n💡 Restart ${clientName} to apply changes.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("interrupted")) {
      console.log("\n❌ Operation cancelled.");
    } else {
      console.error("❌ Error:", message);
    }
    Deno.exit(1);
  }
};
