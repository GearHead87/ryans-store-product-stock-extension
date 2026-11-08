import { create } from "zustand"

import type { Catalog } from "./ryans"

export type Settings = {
  zoneId: number
  zoneName: string
  // Every shop in the zone, as last fetched from Ryans.
  zoneShops: string[]
  selectedShops: string[]
  updatedAt: number
}

const SETTINGS_KEY = "settings"
const CATALOG_KEY = "catalog"

export async function loadSettings(): Promise<Settings | null> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY)
  return (stored[SETTINGS_KEY] as Settings | undefined) ?? null
}

export function saveSettings(settings: Settings) {
  return chrome.storage.local.set({ [SETTINGS_KEY]: settings })
}

export type StoredCatalog = Catalog & { fetchedAt: number }

export async function loadCatalog(): Promise<StoredCatalog | null> {
  const stored = await chrome.storage.local.get(CATALOG_KEY)
  return (stored[CATALOG_KEY] as StoredCatalog | undefined) ?? null
}

export function saveCatalog(catalog: Catalog) {
  const stored: StoredCatalog = { ...catalog, fetchedAt: Date.now() }
  return chrome.storage.local.set({ [CATALOG_KEY]: stored }).then(() => stored)
}

type SettingsState = {
  hydrated: boolean
  settings: Settings | null
}

export const useSettings = create<SettingsState>(() => ({ hydrated: false, settings: null }))

let initialized = false

// Loads settings once and keeps the store in sync when another page (e.g. options) changes them.
export function initSettingsStore() {
  if (initialized) return
  initialized = true

  loadSettings()
    .then((settings) => useSettings.setState({ hydrated: true, settings }))
    .catch(() => useSettings.setState({ hydrated: true, settings: null }))

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && SETTINGS_KEY in changes) {
      useSettings.setState({ hydrated: true, settings: changes[SETTINGS_KEY].newValue ?? null })
    }
  })
}
