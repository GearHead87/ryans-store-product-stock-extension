import { AVAILABILITY_PORT, type AvailabilityRequest, type AvailabilityResponse } from "./messages"
import type { Availability } from "./ryans"

type Pending = {
  request: AvailabilityRequest
  resolve: (result: Availability) => void
  reject: (error: Error) => void
  retried: boolean
}

let port: chrome.runtime.Port | null = null
let nextId = 1
const pending = new Map<number, Pending>()

function getPort() {
  if (port) return port

  const next = chrome.runtime.connect({ name: AVAILABILITY_PORT })
  next.onMessage.addListener((response: AvailabilityResponse) => {
    const entry = pending.get(response.id)
    if (!entry) return
    pending.delete(response.id)
    if ("error" in response) {
      entry.reject(new Error(response.error))
    } else {
      entry.resolve(response.result)
    }
  })
  next.onDisconnect.addListener(() => {
    void chrome.runtime.lastError
    port = null
    // Chrome may have restarted the background worker; resend once on a fresh connection.
    for (const [id, entry] of pending) {
      if (entry.retried) {
        pending.delete(id)
        entry.reject(new Error("Lost connection to the extension"))
      } else {
        entry.retried = true
        send(entry.request)
      }
    }
  })

  port = next
  return next
}

function send(request: AvailabilityRequest) {
  try {
    getPort().postMessage(request)
  } catch (error) {
    // The extension was reloaded or removed; this page's content script is orphaned.
    const entry = pending.get(request.id)
    pending.delete(request.id)
    entry?.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

export function requestAvailability(zoneId: number, sku: string, force = false) {
  return new Promise<Availability>((resolve, reject) => {
    const request: AvailabilityRequest = { id: nextId++, zoneId, sku, force }
    pending.set(request.id, { request, resolve, reject, retried: false })
    send(request)
  })
}
