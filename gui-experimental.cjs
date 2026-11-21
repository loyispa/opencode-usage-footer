// GUI part for OpenCode Desktop: Go usage in the bottom-right corner of the window.
//
// Hand-written CommonJS on purpose: the desktop loads one prebuilt CJS file and
// provides `@opencode/plugin/gui` at runtime. This floats its own elements in the
// window, so it needs neither JSX nor a Vite build.

const { Plugin } = require("@opencode/plugin/gui")

const DEFAULT_INTERVAL_MS = 60_000
const CLOCK_MS = 30_000
const SEPARATOR = " | "

const HUES = {
  rolling: "#3b82f6",
  weekly: "#a855f7",
  monthly: "#14b8a6",
}
const WARNING = "#f5a524"
const DANGER = "#e5484d"

function formatPercent(meter) {
  return `${Math.round(meter.percent)}%${meter.limited ? "!" : ""}`
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "0m"
  const totalMinutes = Math.ceil(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 24) return minutes ? `${hours}h${minutes}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  return rest ? `${days}d${rest}h` : `${days}d`
}

function valueColor(kind, meter) {
  if (meter.limited) return DANGER
  if (meter.percent >= 90) return WARNING
  return HUES[kind]
}

function element(tag, text, style) {
  const node = document.createElement(tag)
  if (text !== undefined) node.textContent = text
  if (style) Object.assign(node.style, style)
  return node
}

module.exports = Plugin.define({
  setup(ctx) {
    const interval = Number(ctx.options?.interval ?? DEFAULT_INTERVAL_MS)

    let limits
    let usageURL
    let status = "loading"
    let disposed = false
    let pill
    let card
    let grid
    let hint

    async function refresh() {
      try {
        const directory = ctx.sessions.current()?.directory
        const result = await ctx.client.experimental.usage.limits(directory ? { location: { directory } } : undefined)
        if (disposed) return
        limits = result.data?.go
        usageURL = result.data?.workspace?.usageURL
        status = limits ? "ready" : "none"
      } catch {
        status = "error"
      }
      paint()
    }

    function meters() {
      return [
        ["rolling", "5h", limits.rolling],
        ["weekly", "wk", limits.weekly],
        ["monthly", "mo", limits.monthly],
      ]
    }

    function renderCard() {
      if (!card || !limits) return
      if (hint) hint.style.display = usageURL ? "block" : "none"
      grid.replaceChildren()
      for (const [kind, name, meter] of meters()) {
        grid.append(
          element("span", name, { opacity: "0.6" }),
          element("span", formatPercent(meter), {
            color: valueColor(kind, meter),
            fontWeight: "600",
            textAlign: "right",
          }),
          element("span", `resets in ${formatDuration(meter.resetsAt - Date.now())}`, { opacity: "0.75" }),
        )
      }
    }

    function positionCard() {
      if (!card || !pill) return
      const rect = pill.getBoundingClientRect()
      card.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`
      card.style.bottom = `${window.innerHeight - rect.top + 6}px`
    }

    function paint() {
      if (!pill) return

      if (status === "none") {
        pill.style.display = "none"
        if (card) card.style.display = "none"
        return
      }

      pill.replaceChildren()
      pill.style.display = "flex"

      if (!limits) {
        pill.append(element("span", status === "error" ? "usage: n/a" : "usage …", { opacity: "0.65" }))
        pill.setAttribute("aria-label", status === "error" ? "OpenCode Go usage unavailable" : "Loading OpenCode Go usage")
        pill.style.cursor = "default"
        return
      }

      for (const [index, [kind, name, meter]] of meters().entries()) {
        if (index > 0) pill.append(element("span", SEPARATOR, { opacity: "0.4" }))
        pill.append(element("span", formatPercent(meter), { color: valueColor(kind, meter), fontWeight: "600" }))
      }
      pill.append(element("span", SEPARATOR, { opacity: "0.4" }))
      pill.append(element("span", formatDuration(limits.rolling.resetsAt - Date.now()), { opacity: "0.65" }))

      pill.setAttribute("aria-label", "OpenCode Go usage")
      pill.style.cursor = usageURL ? "pointer" : "default"
      if (card.style.display === "flex") {
        renderCard()
        positionCard()
      }
    }

    function buildCard() {
      card = element("div", undefined, {
        position: "fixed",
        zIndex: "41",
        display: "none",
        flexDirection: "column",
        gap: "6px",
        padding: "8px 10px",
        borderRadius: "8px",
        fontSize: "11px",
        lineHeight: "1.4",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        userSelect: "none",
        pointerEvents: "none",
        color: "#e4e4e7",
        background: "rgba(24,24,27,0.94)",
        border: "1px solid rgba(127,127,127,0.28)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
      })

      card.append(
        element("div", "OpenCode Go", { fontSize: "10px", letterSpacing: "0.04em", opacity: "0.55" }),
      )

      grid = element("div", undefined, {
        display: "grid",
        gridTemplateColumns: "auto auto auto",
        columnGap: "14px",
        rowGap: "2px",
        alignItems: "baseline",
      })
      card.append(grid)

      hint = element("div", "Click to open usage in Console", {
        fontSize: "10px",
        opacity: "0.45",
        marginTop: "2px",
        display: "none",
      })
      card.append(hint)

      document.body.appendChild(card)
    }

    function mount() {
      if (pill || disposed) return
      if (!document.body) {
        document.addEventListener("DOMContentLoaded", mount, { once: true })
        return
      }

      pill = element("div", undefined, {
        position: "fixed",
        right: "14px",
        bottom: "10px",
        zIndex: "40",
        display: "flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        lineHeight: "1.5",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "pre",
        userSelect: "none",
        color: "inherit",
        background: "rgba(127,127,127,0.12)",
        border: "1px solid rgba(127,127,127,0.16)",
        backdropFilter: "blur(6px)",
      })

      pill.addEventListener("mouseenter", () => {
        if (!limits || !card) return
        renderCard()
        positionCard()
        card.style.display = "flex"
      })
      pill.addEventListener("mouseleave", () => {
        if (card) card.style.display = "none"
      })
      pill.addEventListener("click", () => {
        if (usageURL) ctx.system.openExternal(usageURL)
      })

      document.body.appendChild(pill)
      buildCard()
      paint()
    }

    mount()
    void refresh()
    const timer = setInterval(() => void refresh(), interval)
    const clock = setInterval(() => {
      if (limits && limits.rolling.resetsAt <= Date.now()) void refresh()
      else paint()
    }, CLOCK_MS)

    return () => {
      disposed = true
      clearInterval(timer)
      clearInterval(clock)
      if (pill && pill.isConnected) pill.remove()
      if (card && card.isConnected) card.remove()
      pill = undefined
      card = undefined
      grid = undefined
      hint = undefined
    }
  },
})
