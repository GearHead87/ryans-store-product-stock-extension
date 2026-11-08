import { pruneAvailabilityCache } from "../lib/availability-cache"

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    // First run: go straight to shop selection.
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html?welcome=1") })
  }
  pruneAvailabilityCache().catch(() => {})
})

chrome.runtime.onStartup.addListener(() => {
  pruneAvailabilityCache().catch(() => {})
})

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage()
})

// Content scripts can't open the options page themselves.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "open-options") {
    chrome.runtime.openOptionsPage()
  }
})

export {}
