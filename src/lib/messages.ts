import type { Availability } from "./ryans"

// Content scripts keep one port open to the background worker for stock lookups.
// Closing the tab or leaving the page disconnects it, which cancels that page's queued lookups.
export const AVAILABILITY_PORT = "availability"

export type AvailabilityRequest = {
  type: "lookup"
  id: number
  zoneId: number
  sku: string
  force: boolean
}

// Sent when a card is removed or its lookup is superseded, so it stops holding a place in the queue.
export type CancelRequest = {
  type: "cancel"
  id: number
}

export type PortRequest = AvailabilityRequest | CancelRequest

export type AvailabilityResponse = { id: number; result: Availability } | { id: number; error: string }

export type OpenOptionsMessage = { type: "open-options" }
