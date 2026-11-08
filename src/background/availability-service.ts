import type { AvailabilityRequest, AvailabilityResponse, PortRequest } from "../lib/messages"
import { fetchAvailability, type Availability } from "../lib/ryans"

const CACHE_PREFIX = "avail:"
const CACHE_TTL_MS = 5 * 60 * 1000
const PRUNE_INTERVAL_MS = 60 * 1000

// Ryans' endpoint is undocumented; keep the request rate low. Each response takes ~2.5s server-side.
// The limit is shared by every open Ryans tab.
const MAX_CONCURRENT = 3
const MIN_GAP_MS = 300

type CacheEntry = {
  at: number
  result: Availability
}

type Waiter = {
  port: chrome.runtime.Port
  id: number
  // Set when the page cancels the lookup or disconnects while its cache read is pending.
  cancelled?: boolean
}

type Job = {
  key: string
  zoneId: number
  sku: string
  waiters: Waiter[]
}

// Map insertion order makes this a FIFO queue.
const queued = new Map<string, Job>()
const running = new Map<string, Job>()
let lastStart = 0
let timer: ReturnType<typeof setTimeout> | undefined
let lastPrune = 0
// Lookups waiting on a cache read, before they join or create a job.
const readingCache = new Set<Waiter>()

// storage.session lives in memory, survives the worker being suspended, and isn't visible to content
// scripts, so cache writes don't fire storage events in every Ryans tab.
async function readCache(key: string) {
  const entry = (await chrome.storage.session.get(key))[key] as CacheEntry | undefined
  return entry && Date.now() - entry.at < CACHE_TTL_MS ? entry.result : null
}

function writeCache(key: string, result: Availability) {
  const entry: CacheEntry = { at: Date.now(), result }
  chrome.storage.session.set({ [key]: entry }).catch(() => {})

  if (Date.now() - lastPrune < PRUNE_INTERVAL_MS) return
  lastPrune = Date.now()
  chrome.storage.session
    .get()
    .then((all) => {
      const expired = Object.entries(all)
        .filter(([k, v]) => k.startsWith(CACHE_PREFIX) && Date.now() - (v as CacheEntry).at >= CACHE_TTL_MS)
        .map(([k]) => k)
      return expired.length > 0 ? chrome.storage.session.remove(expired) : undefined
    })
    .catch(() => {})
}

function reply(waiter: Waiter, response: AvailabilityResponse) {
  try {
    waiter.port.postMessage(response)
  } catch {
    // The page went away while we were fetching.
  }
}

function pump() {
  while (running.size < MAX_CONCURRENT && queued.size > 0) {
    const wait = lastStart + MIN_GAP_MS - Date.now()
    if (wait > 0) {
      timer ??= setTimeout(() => {
        timer = undefined
        pump()
      }, wait)
      return
    }

    const job: Job = queued.values().next().value
    queued.delete(job.key)
    running.set(job.key, job)
    lastStart = Date.now()
    run(job)
  }
}

async function run(job: Job) {
  let outcome: { result: Availability } | { error: string }
  try {
    const result = await fetchAvailability(job.zoneId, job.sku)
    writeCache(job.key, result)
    outcome = { result }
  } catch (error) {
    outcome = { error: String((error as Error)?.message ?? error) }
  }

  running.delete(job.key)
  for (const waiter of job.waiters) {
    reply(waiter, { id: waiter.id, ...outcome })
  }
  pump()
}

async function enqueue(port: chrome.runtime.Port, { id, zoneId, sku, force }: AvailabilityRequest) {
  const key = `${CACHE_PREFIX}${zoneId}:${sku}`
  const waiter: Waiter = { port, id }
  const findJob = () => running.get(key) ?? queued.get(key)

  if (!findJob() && !force) {
    readingCache.add(waiter)
    const cached = await readCache(key).finally(() => readingCache.delete(waiter))
    if (waiter.cancelled) return
    if (cached) {
      reply(waiter, { id, result: cached })
      return
    }
  }

  // Another tab may have queued the same product while the cache read was pending.
  const job = findJob()
  if (job) {
    job.waiters.push(waiter)
    return
  }
  queued.set(key, { key, zoneId, sku, waiters: [waiter] })
  pump()
}

// Remove matching waiters, and drop queued lookups that nobody is waiting for anymore.
function dropWaiters(matches: (waiter: Waiter) => boolean) {
  for (const waiter of readingCache) {
    if (matches(waiter)) waiter.cancelled = true
  }
  for (const job of [...queued.values(), ...running.values()]) {
    job.waiters = job.waiters.filter((waiter) => !matches(waiter))
    if (job.waiters.length === 0) {
      queued.delete(job.key)
    }
  }
}

export function handleAvailabilityPort(port: chrome.runtime.Port) {
  port.onMessage.addListener((request: PortRequest) => {
    if (request.type === "cancel") {
      dropWaiters((waiter) => waiter.port === port && waiter.id === request.id)
      return
    }
    enqueue(port, request).catch((error) => reply({ port, id: request.id }, { id: request.id, error: String(error) }))
  })
  port.onDisconnect.addListener(() => dropWaiters((waiter) => waiter.port === port))
}

// Earlier versions cached results in storage.local; remove them.
export async function removeLegacyCache() {
  const all = await chrome.storage.local.get()
  const legacy = Object.keys(all).filter((key) => key.startsWith(CACHE_PREFIX))
  if (legacy.length > 0) {
    await chrome.storage.local.remove(legacy)
  }
}
