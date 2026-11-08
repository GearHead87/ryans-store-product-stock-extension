import cssText from "data-text:./styles/stock-badge.css"
import type { PlasmoCSConfig, PlasmoCSUIProps, PlasmoGetInlineAnchorList, PlasmoGetStyle } from "plasmo"
import { useEffect, useRef, useState, type MouseEvent } from "react"

import { getAvailability } from "./lib/availability-cache"
import { CARD_SELECTOR, describeDelivery, isInStockNow, readCardSku, type Availability, type Branch } from "./lib/ryans"
import { initSettingsStore, useSettings } from "./lib/settings"

export const config: PlasmoCSConfig = {
  matches: ["https://www.ryans.com/*"]
}

// One stock block per product card, right below the price. Plasmo re-runs this when the page changes.
export const getInlineAnchorList: PlasmoGetInlineAnchorList = () =>
  [...document.querySelectorAll(CARD_SELECTOR)].flatMap((card): { element: Element; insertPosition: InsertPosition }[] => {
    if (!readCardSku(card)) return []
    const price = card.querySelector(".pr-text")
    if (price) return [{ element: price, insertPosition: "afterend" }]
    const body = card.querySelector(".card-body")
    return body ? [{ element: body, insertPosition: "beforeend" }] : []
  })

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

initSettingsStore()

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: Availability }
  | { status: "error"; message: string }

function useAvailability(zoneId: number | undefined, sku: string | null, visible: boolean) {
  const [state, setState] = useState<LookupState>({ status: "idle" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!zoneId || !sku || !visible) return
    let cancelled = false
    setState({ status: "loading" })
    getAvailability(zoneId, sku, { force: attempt > 0 })
      .then((result) => !cancelled && setState({ status: "done", result }))
      .catch((error) => !cancelled && setState({ status: "error", message: String(error?.message ?? error) }))
    return () => {
      cancelled = true
    }
  }, [zoneId, sku, visible, attempt])

  return { state, retry: () => setAttempt((n) => n + 1) }
}

// Waits until the card is near the viewport so a long listing doesn't fire every request at once.
function useNearViewport() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || visible) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "300px 0px" }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [visible])

  return { ref, visible }
}

// Keeps clicks inside the block from reaching the card's stretched product link.
function handled(action: () => void) {
  return (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    action()
  }
}

function openSettings() {
  chrome.runtime.sendMessage({ type: "open-options" }).catch(() => {})
}

function StockBadge({ anchor }: PlasmoCSUIProps) {
  const card = anchor?.element.closest(CARD_SELECTOR)
  const sku = card ? readCardSku(card) : null
  const { hydrated, settings } = useSettings()
  const { ref, visible } = useNearViewport()
  const { state, retry } = useAvailability(settings?.zoneId, sku, visible)
  const [expanded, setExpanded] = useState(false)

  if (!sku || !hydrated) {
    return <div ref={ref} />
  }

  if (!settings) {
    return (
      <div ref={ref} className="rsc">
        <button type="button" className="rsc-link" onClick={handled(openSettings)}>
          Choose your Ryans shop to see stock
        </button>
      </div>
    )
  }

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div ref={ref} className="rsc rsc-muted">
        Checking stock…
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div ref={ref} className="rsc rsc-muted">
        Couldn't check stock.{" "}
        <button type="button" className="rsc-link" onClick={handled(retry)} title={state.message}>
          Retry
        </button>
      </div>
    )
  }

  if (state.result.kind === "not-found") {
    return (
      <div ref={ref} className="rsc rsc-muted">
        No stock info from Ryans for this product
      </div>
    )
  }

  const branches = state.result.branches
  const byName = new Map<string, Branch>(branches.map((branch) => [branch.name, branch]))
  const inStockCount = branches.filter((branch) => isInStockNow(branch.deliveryTime)).length

  return (
    <div ref={ref} className="rsc">
      <ul className="rsc-list">
        {settings.selectedShops.map((name) => {
          const branch = byName.get(name)
          const tone = !branch ? "unknown" : isInStockNow(branch.deliveryTime) ? "in" : "transfer"
          return (
            <li key={name} className={`rsc-row rsc-${tone}`}>
              <span className="rsc-dot" />
              <span className="rsc-name">{name}</span>
              <span className="rsc-status">{branch ? describeDelivery(branch.deliveryTime) : "Not listed"}</span>
            </li>
          )
        })}
      </ul>

      <button type="button" className="rsc-link rsc-summary" onClick={handled(() => setExpanded(!expanded))}>
        {inStockCount > 0
          ? `In stock at ${inStockCount} of ${branches.length} ${settings.zoneName} shops`
          : `Not in stock at any ${settings.zoneName} shop now`}{" "}
        {expanded ? "▴" : "▾"}
      </button>

      {expanded && (
        <ul className="rsc-list rsc-all">
          {branches.map((branch) => (
            <li key={branch.name} className={`rsc-row rsc-${isInStockNow(branch.deliveryTime) ? "in" : "transfer"}`}>
              <span className="rsc-dot" />
              <span className="rsc-name">{branch.name}</span>
              <span className="rsc-status">{describeDelivery(branch.deliveryTime)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default StockBadge
