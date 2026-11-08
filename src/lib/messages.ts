import type { Availability } from "./ryans"

// Content scripts keep one port open to the background worker for stock lookups.
// Closing the tab or leaving the page disconnects it, which cancels that page's queued lookups.
export const AVAILABILITY_PORT = "availability"

export type AvailabilityRequest = {
  id: number
  zoneId: number
  sku: string
  force: boolean
}

export type AvailabilityResponse = { id: number; result: Availability } | { id: number; error: string }

export type OpenOptionsMessage = { type: "open-options" }
