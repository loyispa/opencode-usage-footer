import { Plugin } from "@opencode/plugin"

/**
 * Server part is intentionally empty: this plugin only contributes a TUI footer
 * item. It exists so the plugin directory follows the standard layout
 * (index.ts + tui.tsx) that OpenCode discovers.
 */
export default Plugin.define({
  id: "usage-footer",
  setup() {},
})
