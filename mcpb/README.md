# vibe for Claude Desktop

Install the npm package, build `vibe plugin mcpb --out vibe.mcpb`, then open the bundle in Claude Desktop and select your project. The existing executable setting handles installations outside the desktop app PATH.

The tool catalog exposes only `vibe`. Start with operation `brief`. Operation `discover` lists internal capabilities; with `{ "operation": "skill" }` in arguments it returns the selected capability schema. Use `guide` to read only the workflow or authoring guidance needed now. Skill research, installation and creation remain available through the internal `skill` operation.

Vibe uses the current host model. There is no automatic extra model review. Reuse known context and authority, ask only for material missing information and verify actual behavior. External effects still require the applicable user and host permission.

The transport delegates to the installed CLI in the selected project. Its verification and legacy tool calls remain compatible, although old tool names are no longer advertised. Building code requires the host's available tools; this extension does not expose an arbitrary shell.
