import cssText from "data-text:./styles/stock-badge.css"
import type { PlasmoCSConfig } from "plasmo"

import { requestAvailability } from "./lib/availability-client"
import type { OpenOptionsMessage } from "./lib/messages"
import { CARD_SELECTOR, describeDelivery, isInStockNow, readCardSku, type Availability, type Branch } from "./lib/ryans"
import { loadSettings, SETTINGS_KEY, type Settings } from "./lib/settings"

export const config: PlasmoCSConfig = {
  matches: ["https://www.ryans.com/*"]
}

// Plain DOM instead of a framework: this runs on every Ryans page and renders one block per product card.

const HOST_TAG = "ryans-stock-checker"
const RESCAN_DELAY_MS = 200

type LookupState =
  | { status: "waiting" }
  | { status: "loading" }
  | { status: "done"; result: Availability }
  | { status: "error"; message: string }

type Badge = {
  card: Element
  sku: string
  host: HTMLElement
  container: HTMLElement
  state: LookupState
  visible: boolean
  expanded: boolean
  // Bumped on every lookup so a late response can't overwrite a newer one.
  lookupToken: number
}

let settings: Settings | null = null
const badges = new Map<Element, Badge>()
const badgeByHost = new WeakMap<Element, Badge>()

// One stylesheet object shared by every card's shadow root.
let sharedSheet: CSSStyleSheet | null | undefined

function applyStyles(root: ShadowRoot) {
  if (sharedSheet === undefined) {
    try {
      sharedSheet = new CSSStyleSheet()
      sharedSheet.replaceSync(cssText)
    } catch {
      sharedSheet = null
    }
  }
  if (sharedSheet) {
    try {
      root.adoptedStyleSheets = [sharedSheet]
      return
    } catch {
      sharedSheet = null
    }
  }
  const style = document.createElement("style")
  style.textContent = cssText
  root.append(style)
}

function el(tag: string, className: string, ...children: Array<Node | string>) {
  const element = document.createElement(tag)
  element.className = className
  element.append(...children)
  return element
}

function button(className: string, label: string, onClick: () => void, title?: string) {
  const element = el("button", className, label) as HTMLButtonElement
  element.type = "button"
  if (title) element.title = title
  element.addEventListener("click", (event) => {
    // Keep the click away from the card's stretched product link.
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })
  return element
}

function branchRow(name: string, branch: Branch | undefined) {
  const tone = !branch ? "unknown" : isInStockNow(branch.deliveryTime) ? "in" : "transfer"
  return el(
    "li",
    `rsc-row rsc-${tone}`,
    el("span", "rsc-dot"),
    el("span", "rsc-name", name),
    el("span", "rsc-status", branch ? describeDelivery(branch.deliveryTime) : "Not listed")
  )
}

function openSettings() {
  const message: OpenOptionsMessage = { type: "open-options" }
  chrome.runtime.sendMessage(message).catch(() => {})
}

function renderContent(badge: Badge): HTMLElement {
  if (!settings) {
    return el("div", "rsc", button("rsc-link", "Choose your Ryans shop to see stock", openSettings))
  }

  const { state } = badge
  if (state.status === "waiting" || state.status === "loading") {
    return el("div", "rsc rsc-muted", "Checking stock…")
  }
  if (state.status === "error") {
    return el(
      "div",
      "rsc rsc-muted",
      "Couldn't check stock. ",
      button("rsc-link", "Retry", () => lookup(badge, true), state.message)
    )
  }
  if (state.result.kind === "not-found") {
    return el("div", "rsc rsc-muted", "No stock info from Ryans for this product")
  }

  const branches = state.result.branches
  const byName = new Map(branches.map((branch) => [branch.name, branch]))
  const inStockCount = branches.filter((branch) => isInStockNow(branch.deliveryTime)).length
  const summary =
    inStockCount > 0
      ? `In stock at ${inStockCount} of ${branches.length} ${settings.zoneName} shops`
      : `Not in stock at any ${settings.zoneName} shop now`

  const block = el(
    "div",
    "rsc",
    el("ul", "rsc-list", ...settings.selectedShops.map((name) => branchRow(name, byName.get(name)))),
    button("rsc-link rsc-summary", `${summary} ${badge.expanded ? "▴" : "▾"}`, () => {
      badge.expanded = !badge.expanded
      render(badge)
    })
  )
  if (badge.expanded) {
    block.append(el("ul", "rsc-list rsc-all", ...branches.map((branch) => branchRow(branch.name, branch))))
  }
  return block
}

function render(badge: Badge) {
  badge.container.replaceChildren(renderContent(badge))
}

function lookup(badge: Badge, force = false) {
  if (!settings) return
  const token = ++badge.lookupToken
  badge.state = { status: "loading" }
  render(badge)

  requestAvailability(settings.zoneId, badge.sku, force)
    .then(
      (result): LookupState => ({ status: "done", result }),
      (error): LookupState => ({ status: "error", message: String(error?.message ?? error) })
    )
    .then((next) => {
      if (badge.lookupToken !== token || badges.get(badge.card) !== badge) return
      badge.state = next
      render(badge)
    })
}

// Look up stock only once a card is near the viewport, so long listings don't fire every request at once.
const viewport = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      viewport.unobserve(entry.target)
      const badge = badgeByHost.get(entry.target)
      if (!badge) continue
      badge.visible = true
      if (settings) lookup(badge)
    }
  },
  { rootMargin: "300px 0px" }
)

function mount(card: Element) {
  const sku = readCardSku(card)
  if (!sku) return

  const anchor = card.querySelector(".pr-text") ?? card.querySelector(".card-body")
  if (!anchor) return

  const host = document.createElement(HOST_TAG)
  const root = host.attachShadow({ mode: "open" })
  applyStyles(root)
  const container = document.createElement("div")
  root.append(container)

  if (anchor.matches(".pr-text")) {
    anchor.after(host)
  } else {
    anchor.append(host)
  }

  const badge: Badge = {
    card,
    sku,
    host,
    container,
    state: { status: "waiting" },
    visible: false,
    expanded: false,
    lookupToken: 0
  }
  badges.set(card, badge)
  badgeByHost.set(host, badge)
  render(badge)
  viewport.observe(host)
}

function unmount(badge: Badge) {
  viewport.unobserve(badge.host)
  badge.host.remove()
  badges.delete(badge.card)
}

function scan() {
  for (const badge of badges.values()) {
    if (!badge.card.isConnected || !badge.card.contains(badge.host)) {
      unmount(badge)
    }
  }
  for (const card of document.querySelectorAll(CARD_SELECTOR)) {
    if (!badges.has(card)) {
      mount(card)
    }
  }
}

// Rescan shortly after the page adds or removes elements, ignoring our own blocks being inserted.
let rescanTimer: ReturnType<typeof setTimeout> | undefined

function isPageChange(mutations: MutationRecord[]) {
  for (const mutation of mutations) {
    for (const nodes of [mutation.addedNodes, mutation.removedNodes]) {
      for (const node of nodes) {
        if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== HOST_TAG.toUpperCase()) {
          return true
        }
      }
    }
  }
  return false
}

const pageObserver = new MutationObserver((mutations) => {
  if (rescanTimer !== undefined || !isPageChange(mutations)) return
  rescanTimer = setTimeout(() => {
    rescanTimer = undefined
    scan()
  }, RESCAN_DELAY_MS)
})

function applySettings(next: Settings | null) {
  const zoneChanged = settings?.zoneId !== next?.zoneId
  settings = next
  for (const badge of badges.values()) {
    if (zoneChanged) {
      badge.lookupToken++
      badge.state = { status: "waiting" }
      badge.expanded = false
      if (badge.visible && settings) {
        lookup(badge)
        continue
      }
    }
    render(badge)
  }
}

loadSettings()
  .catch(() => null)
  .then((loaded) => {
    settings = loaded
    scan()
    pageObserver.observe(document.body, { childList: true, subtree: true })
  })

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && SETTINGS_KEY in changes) {
    applySettings(changes[SETTINGS_KEY].newValue ?? null)
  }
})
