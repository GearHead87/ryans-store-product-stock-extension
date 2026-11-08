import { fetchAvailability, type Availability } from "./ryans"

const CACHE_PREFIX = "avail:"
const CACHE_TTL_MS = 5 * 60 * 1000

// Ryans' endpoint is undocumented; keep the request rate low. Each response takes ~2.5s server-side.
const MAX_CONCURRENT = 3
const MIN_GAP_MS = 300

type CacheEntry = {
  at: number
  result: Availability
}

let active = 0
let lastStart = 0
let timer: ReturnType<typeof setTimeout> | undefined
const waiting: Array<() => void> = []

function pump() {
  if (active >= MAX_CONCURRENT || waiting.length === 0) return

  const wait = lastStart + MIN_GAP_MS - Date.now()
  if (wait > 0) {
    timer ??= setTimeout(() => {
      timer = undefined
      pump()
    }, wait)
    return
  }

  active++
  lastStart = Date.now()
  waiting.shift()!()
  pump()
}

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    waiting.push(() => {
      task()
        .then(resolve, reject)
        .finally(() => {
          active--
          pump()
        })
    })
    pump()
  })
}

const inFlight = new Map<string, Promise<Availability>>()

export function getAvailability(zoneId: number, sku: string, { force = false } = {}) {
  const key = `${CACHE_PREFIX}${zoneId}:${sku}`
  const pending = inFlight.get(key)
  if (pending) return pending

  const promise = (async () => {
    if (!force) {
      const cached = (await chrome.storage.local.get(key))[key] as CacheEntry | undefined
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.result
      }
    }

    const result = await schedule(() => fetchAvailability(zoneId, sku))
    const entry: CacheEntry = { at: Date.now(), result }
    chrome.storage.local.set({ [key]: entry }).catch(() => {})
    return result
  })().finally(() => inFlight.delete(key))

  inFlight.set(key, promise)
  return promise
}

export async function pruneAvailabilityCache() {
  const all = await chrome.storage.local.get()
  const expired = Object.entries(all)
    .filter(([key, value]) => key.startsWith(CACHE_PREFIX) && Date.now() - (value as CacheEntry).at >= CACHE_TTL_MS)
    .map(([key]) => key)
  if (expired.length > 0) {
    await chrome.storage.local.remove(expired)
  }
}
