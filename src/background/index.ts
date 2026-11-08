import { AVAILABILITY_PORT, type OpenOptionsMessage } from "../lib/messages"
import { handleAvailabilityPort, removeLegacyCache } from "./availability-service"

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    // First run: go straight to shop selection.
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html?welcome=1") })
  }
  removeLegacyCache().catch(() => {})
})

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage()
})

// Content scripts can't open the options page themselves.
chrome.runtime.onMessage.addListener((message: OpenOptionsMessage) => {
  if (message?.type === "open-options") {
    chrome.runtime.openOptionsPage()
  }
})

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === AVAILABILITY_PORT) {
    handleAvailabilityPort(port)
  }
})

export {}
