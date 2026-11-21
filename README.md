# opencode-usage-footer

Show your [OpenCode Go](https://opencode.ai/docs/console/go/) allowance while you work: the rolling
5-hour window, the weekly window, and the monthly period, plus when the 5-hour window resets.

Two surfaces, one plugin:

- **Desktop** — a small pill in the bottom-right corner of the window.
- **Terminal** — the same readout in the TUI footer.

```
26% | 10% | 5% | 2h30m
```

Each number is the **used** share of that window. The last field is the time until the 5-hour window
resets. Percentages turn amber at 90% and red (with `!`) when a window is exhausted.

## Requirements

- OpenCode 2.x.
- A signed-in OpenCode Console workspace. The plugin reads
  [`GET /api/experimental/usage/limits`](https://opencode.ai/docs/api), so it only has data for OpenCode
  Go, Go Plus, and Go Teams workspaces. Without Go it stays hidden.

## Install

Add the plugin to your global configuration, then restart OpenCode:

```jsonc title="~/.config/opencode/opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:loyispa/opencode-usage-footer"]
}
```

A local checkout works too:

```jsonc
{
  "plugins": ["./plugins/opencode-usage-footer"]
}
```

The desktop loads plugin GUI code once per app launch, so fully quit and reopen after installing or
updating the plugin.

## Usage

**Desktop.** The pill sits in the window's bottom-right corner. Hover it for an aligned breakdown of
each window and its reset time; click it to open your usage page in OpenCode Console.

**Terminal.** The same numbers appear in the prompt footer. Run `/usage` for OpenCode's own usage
panel, which includes budgets as well.

## Options

```jsonc
{
  "plugins": [
    {
      "package": "opencode-usage-footer",
      "options": {
        "interval": 60000
      }
    }
  ]
}
```

| Option     | Type   | Default | Applies to | Description                                            |
| ---------- | ------ | ------- | ---------- | ------------------------------------------------------ |
| `interval` | number | `60000` | both | Milliseconds between usage refreshes. |

Both surfaces also refresh shortly after each assistant step records usage, and again when the
5-hour window rolls over.

## How it works

- `GET /api/experimental/usage/limits` returns `go.rolling`, `go.weekly`, and `go.monthly`, each with
  `percent`, `limited`, and `resetsAt`.
- The terminal part renders into the `prompt.footer.status` slot.
- The desktop part is a prebuilt CommonJS GUI bundle. It floats its own element in the window instead
  of using a slot, so it needs no JSX build step.

The usage API is marked experimental upstream; fields may change in a future OpenCode release.

## License

MIT
