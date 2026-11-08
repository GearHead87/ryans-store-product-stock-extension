import "./styles/options.css"

import { useEffect, useState } from "react"

import { discoverCatalog, discoverShops, RYANS_ORIGIN } from "./lib/ryans"
import { loadCatalog, loadSettings, saveCatalog, saveSettings, type Settings, type StoredCatalog } from "./lib/settings"

// Zones rarely change; re-read them from Ryans about once a week.
const CATALOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const isWelcome = new URLSearchParams(location.search).has("welcome")

type ShopsState =
  | { status: "idle" | "loading" }
  | { status: "ready"; shops: string[] }
  | { status: "error"; message: string }

function RyansStockCheckerOptions() {
  const [catalog, setCatalog] = useState<StoredCatalog | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [saved, setSaved] = useState<Settings | null>(null)
  const [zoneId, setZoneId] = useState<number | null>(null)
  const [shopsState, setShopsState] = useState<ShopsState>({ status: "idle" })
  const [selected, setSelected] = useState<string[]>([])
  const [justSaved, setJustSaved] = useState(false)

  async function refreshCatalog() {
    setCatalogLoading(true)
    setCatalog(await saveCatalog(await discoverCatalog()))
    setCatalogLoading(false)
  }

  useEffect(() => {
    ;(async () => {
      const [settings, stored] = await Promise.all([loadSettings(), loadCatalog()])
      setSaved(settings)
      if (settings) {
        setZoneId(settings.zoneId)
        setShopsState({ status: "ready", shops: settings.zoneShops })
        setSelected(settings.selectedShops)
      }
      if (stored && Date.now() - stored.fetchedAt < CATALOG_MAX_AGE_MS) {
        setCatalog(stored)
        setCatalogLoading(false)
      } else {
        await refreshCatalog()
      }
    })()
  }, [])

  async function loadShops(id: number) {
    if (!catalog) return
    setShopsState({ status: "loading" })
    try {
      const shops = await discoverShops(id, catalog.probeSkus)
      setShopsState({ status: "ready", shops })
      setSelected((current) => current.filter((name) => shops.includes(name)))
    } catch (error) {
      setShopsState({ status: "error", message: String((error as Error)?.message ?? error) })
    }
  }

  function chooseZone(id: number) {
    if (id === zoneId) return
    setZoneId(id)
    setSelected([])
    setJustSaved(false)
    loadShops(id)
  }

  function toggleShop(name: string) {
    setJustSaved(false)
    setSelected((current) => (current.includes(name) ? current.filter((shop) => shop !== name) : [...current, name]))
  }

  async function save() {
    if (!zoneId || shopsState.status !== "ready" || selected.length === 0) return
    const zoneName = catalog?.zones.find((zone) => zone.id === zoneId)?.name ?? saved?.zoneName ?? `Zone ${zoneId}`
    const settings: Settings = {
      zoneId,
      zoneName,
      zoneShops: shopsState.shops,
      // Keep the shops in Ryans' order.
      selectedShops: shopsState.shops.filter((name) => selected.includes(name)),
      updatedAt: Date.now()
    }
    await saveSettings(settings)
    setSaved(settings)
    setJustSaved(true)
  }

  const dirty =
    !saved ||
    saved.zoneId !== zoneId ||
    saved.selectedShops.length !== selected.length ||
    saved.selectedShops.some((name) => !selected.includes(name))

  return (
    <main className="options-shell">
      <section className="settings-panel">
        <h1>{isWelcome && !saved ? "Welcome to Ryans Stock Checker" : "Ryans Stock Checker"}</h1>
        <p className="lead">
          Pick the Ryans shops you buy from. Category and search pages will show whether each product is in stock
          there.
        </p>

        <h2>1. Your area</h2>
        {catalogLoading && !catalog ? (
          <p className="muted">Loading areas from Ryans…</p>
        ) : (
          <>
            <div className="zone-grid">
              {catalog?.zones.map((zone) => (
                <label key={zone.id} className={`chip ${zone.id === zoneId ? "chip-active" : ""}`}>
                  <input
                    type="radio"
                    name="zone"
                    checked={zone.id === zoneId}
                    onChange={() => chooseZone(zone.id)}
                  />
                  {zone.name}
                </label>
              ))}
            </div>
            {catalog && !catalog.live && (
              <p className="muted small">Couldn't read the latest area list from Ryans, so a built-in list is shown.</p>
            )}
          </>
        )}

        {zoneId !== null && (
          <>
            <h2>2. Your shops</h2>
            {shopsState.status === "loading" && <p className="muted">Loading shops…</p>}
            {shopsState.status === "error" && (
              <p className="error">
                Couldn't load shops: {shopsState.message}.{" "}
                <button type="button" className="link" onClick={() => loadShops(zoneId)}>
                  Try again
                </button>
              </p>
            )}
            {shopsState.status === "ready" && (
              <>
                <div className="shop-list">
                  {shopsState.shops.map((name) => (
                    <label key={name} className="shop">
                      <input type="checkbox" checked={selected.includes(name)} onChange={() => toggleShop(name)} />
                      {name}
                    </label>
                  ))}
                </div>
                <button type="button" className="link small" onClick={() => loadShops(zoneId)}>
                  Refresh shop list
                </button>
              </>
            )}
          </>
        )}

        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={shopsState.status !== "ready" || selected.length === 0 || !dirty}
            onClick={save}>
            Save
          </button>
          {justSaved && (
            <span className="saved">
              Saved. <a href={RYANS_ORIGIN}>Open Ryans</a> and browse a category or search.
            </span>
          )}
          {!justSaved && shopsState.status === "ready" && selected.length === 0 && (
            <span className="muted small">Select at least one shop.</span>
          )}
        </div>

        {saved && (
          <p className="muted small current">
            Current: {saved.selectedShops.join(", ")} ({saved.zoneName})
          </p>
        )}

        <footer className="muted small">
          Stock comes from Ryans' own availability check. Not affiliated with Ryans Computers.{" "}
          <button type="button" className="link" onClick={refreshCatalog} disabled={catalogLoading}>
            Reload area list
          </button>
        </footer>
      </section>
    </main>
  )
}

export default RyansStockCheckerOptions
