import { Plugin } from "@opencode/plugin/tui"
import { createSignal, Show } from "solid-js"

type Meter = {
  percent: number
  limited: boolean
  resetsAt: number
}

type UsageLimits = {
  go?: {
    rolling: Meter
    weekly: Meter
    monthly: Meter
  }
}

const DEFAULT_INTERVAL_MS = 60_000
const EVENT_DEBOUNCE_MS = 1_500

function formatPercent(meter: Meter) {
  return `${Math.round(meter.percent)}%${meter.limited ? "!" : ""}`
}

function formatDuration(ms: number) {
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

function formatReset(meter: Meter | undefined, now: number) {
  if (!meter) return undefined
  return formatDuration(meter.resetsAt - now)
}

export default Plugin.define({
  id: "usage-footer",
  setup(context) {
    const interval = Number(context.options.interval ?? DEFAULT_INTERVAL_MS)

    const [limits, setLimits] = createSignal<UsageLimits>()
    const [loading, setLoading] = createSignal(true)
    const [now, setNow] = createSignal(Date.now())
    let disposed = false

    async function refresh() {
      try {
        const result = await context.client.experimental.usage.limits({
          location: context.location,
        })
        if (disposed) return
        setLimits(result.data ?? undefined)
      } catch {
        // Keep the last known value; a transient failure should not blank the footer.
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), interval)
    const clock = setInterval(() => {
      const current = Date.now()
      setNow(current)
      // When the 5-hour window rolls over, pull fresh numbers instead of waiting
      // for the next poll.
      const rolling = limits()?.go?.rolling
      if (rolling && rolling.resetsAt <= current) void refresh()
    }, 30_000)

    let pending: ReturnType<typeof setTimeout> | undefined
    const stop = context.data.on("session.usage.updated", () => {
      if (pending) return
      pending = setTimeout(() => {
        pending = undefined
        void refresh()
      }, EVENT_DEBOUNCE_MS)
    })

    const go = () => limits()?.go
    const faint = () => context.theme.text.faint

    function tone(meter: Meter) {
      if (meter.limited) return context.theme.text.feedback.error.base
      if (meter.percent >= 90) return context.theme.text.feedback.warning.base
      return context.theme.text.base
    }

    function Footer() {
      return (
        <Show when={go()} fallback={<text fg={faint()}>{loading() ? "usage …" : ""}</text>}>
          <text>
            <span fg={tone(go()!.rolling)}>{formatPercent(go()!.rolling)}</span>
            <span fg={faint()}>{"\u00a0|\u00a0"}</span>
            <span fg={tone(go()!.weekly)}>{formatPercent(go()!.weekly)}</span>
            <span fg={faint()}>{"\u00a0|\u00a0"}</span>
            <span fg={tone(go()!.monthly)}>{formatPercent(go()!.monthly)}</span>
            <span fg={faint()}>{"\u00a0|\u00a0"}</span>
            <span fg={faint()}>{formatReset(go()!.rolling, now())}</span>
          </text>
        </Show>
      )
    }

    const dispose = context.ui.slot({ append: "prompt.footer.status", render: () => <Footer /> })

    return () => {
      disposed = true
      clearInterval(timer)
      clearInterval(clock)
      if (pending) clearTimeout(pending)
      stop()
      dispose()
    }
  },
})
