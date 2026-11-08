export const RYANS_ORIGIN = "https://www.ryans.com"

export const CARD_SELECTOR = "div.card.h-100"

export type Zone = {
  id: number
  name: string
}

// Zone ids from the "Check Availability" pop-up (input.zones_link) on product pages.
// Used when the live list can't be read.
export const FALLBACK_ZONES: Zone[] = [
  { id: 4, name: "Dhaka" },
  { id: 5, name: "Chattogram" },
  { id: 6, name: "Rajshahi" },
  { id: 10, name: "Khulna" },
  { id: 11, name: "Barishal" },
  { id: 9, name: "Mymensingh" },
  { id: 8, name: "Bogura" },
  { id: 7, name: "Rangpur" },
  { id: 14, name: "Jashore" },
  { id: 16, name: "Dinajpur" },
  { id: 13, name: "Sylhet" },
  { id: 15, name: "Kushtia" }
]

// Any valid SKU returns every branch in a zone, so these are only used to discover branch names.
const FALLBACK_PROBE_SKUS = ["02.02.033.260", "02.01.006.118", "33.03.005.512"]

const REQUEST_TIMEOUT_MS = 20_000

export type Branch = {
  name: string
  deliveryTime: string
}

export type Availability = { kind: "found"; branches: Branch[] } | { kind: "not-found" }

export async function fetchAvailability(zoneId: number, sku: string): Promise<Availability> {
  // "availabiliy" is Ryans' spelling.
  const response = await fetch(`${RYANS_ORIGIN}/zones-availabiliy/${zoneId}/${encodeURIComponent(sku)}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) {
    throw new Error(`Ryans returned HTTP ${response.status}`)
  }

  // The response is labelled text/html but the body is JSON.
  let body: any
  try {
    body = JSON.parse(await response.text())
  } catch {
    throw new Error("Ryans returned a page instead of stock data")
  }

  if (body?.status === true && Array.isArray(body.location_groups)) {
    return {
      kind: "found",
      branches: body.location_groups.map((group: any) => ({
        name: String(group.group_name ?? "").trim(),
        deliveryTime: String(group.delivery_time ?? "").trim()
      }))
    }
  }
  if (body?.status === false) {
    return { kind: "not-found" }
  }
  throw new Error("Unexpected stock data from Ryans")
}

// "0 Day" means the branch has it now; anything else ("2 Hours", "3 Days") is a transfer.
export function isInStockNow(deliveryTime: string) {
  return /^0\s*days?$/i.test(deliveryTime)
}

export function describeDelivery(deliveryTime: string) {
  return isInStockNow(deliveryTime) ? "In stock" : `In ${deliveryTime}`
}

export const SKU_SELECTOR = ".found-text"
const SKU_PATTERN = /^\d+(\.\d+)+$/

// Category cards have the SKU twice (grid and list view); search cards have it once.
export function readCardSku(card: Element): string | null {
  for (const element of card.querySelectorAll(SKU_SELECTOR)) {
    const text = element.textContent?.trim() ?? ""
    if (SKU_PATTERN.test(text)) {
      return text
    }
  }
  return null
}

async function fetchDocument(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Ryans returned HTTP ${response.status}`)
  }
  return new DOMParser().parseFromString(await response.text(), "text/html")
}

export type Catalog = {
  zones: Zone[]
  probeSkus: string[]
  live: boolean
}

// Reads the zone list from a live product page, falling back to the hardcoded list.
// Needs DOMParser, so only call it from extension pages, not the background worker.
export async function discoverCatalog(): Promise<Catalog> {
  let probeSkus: string[] = []
  try {
    const listing = await fetchDocument(`${RYANS_ORIGIN}/search?search=laptop`)
    const cards = [...listing.querySelectorAll(CARD_SELECTOR)]
    probeSkus = cards
      .map(readCardSku)
      .filter((sku): sku is string => sku !== null)
      .slice(0, 5)

    const href = cards[0]?.querySelector("a[href]")?.getAttribute("href")
    const productUrl = href ? new URL(href, RYANS_ORIGIN) : null
    if (!productUrl || productUrl.origin !== RYANS_ORIGIN) {
      throw new Error("No product link on the listing page")
    }

    const product = await fetchDocument(productUrl.href)
    const zones = [...product.querySelectorAll("input.zones_link[id]")]
      .map((input) => ({
        id: Number(input.id),
        name: (input.getAttribute("data-name") ?? input.getAttribute("value") ?? "").trim()
      }))
      .filter((zone) => Number.isInteger(zone.id) && zone.id > 0 && zone.name)
    if (zones.length === 0) {
      throw new Error("No zones on the product page")
    }

    return { zones, probeSkus: [...probeSkus, ...FALLBACK_PROBE_SKUS], live: true }
  } catch {
    return { zones: FALLBACK_ZONES, probeSkus: [...probeSkus, ...FALLBACK_PROBE_SKUS], live: false }
  }
}

export async function discoverShops(zoneId: number, probeSkus: string[]): Promise<string[]> {
  let lastError: unknown = null
  for (const sku of probeSkus.slice(0, 6)) {
    try {
      const availability = await fetchAvailability(zoneId, sku)
      if (availability.kind === "found" && availability.branches.length > 0) {
        return availability.branches.map((branch) => branch.name)
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Ryans didn't return any shops for this zone")
}
