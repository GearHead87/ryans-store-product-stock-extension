# Ryans Stock Checker

Chrome extension that shows Ryans Computers (https://www.ryans.com) store stock availability on product pages and category product cards.

## How it works

1. On install, the settings page opens. Pick your area (zone) and one or more Ryans shops in it. Clicking the extension icon opens the same page later.
2. On Ryans category and search pages, each product card gets a stock block under the price: your shops' status ("In stock" or a transfer time like "In 2 Hours") and a summary for every shop in the area.

Stock comes from Ryans' undocumented `GET /zones-availabiliy/{zoneId}/{sku}` endpoint (the same one the product page's "Check Availability" button uses). Cards load lazily as they scroll into view. The background worker makes the requests through one queue shared by all tabs (at most 3 at a time), drops a page's queued lookups when you leave it, and caches results for 5 minutes in `chrome.storage.session`.

The content script is plain DOM (about 12 KB) and only rescans the page when Ryans adds or removes elements, so it costs nothing while a page sits idle.

## Tech stack

- [Plasmo](https://www.plasmo.com/) (Chrome MV3)
- TypeScript; React 18 for the settings page

## Development

```bash
pnpm install
pnpm dev        # load build/chrome-mv3-dev as an unpacked extension
pnpm typecheck
pnpm build      # production build in build/chrome-mv3-prod
pnpm package    # zip in build/chrome-mv3-prod.zip
```

## Release

Push a tag like `v1.0.0`; the GitHub Actions workflow builds, packages, and publishes a release.

## Docs

- [Before publish checklist](docs/before-publish.md)
- [Privacy policy draft](docs/privacy-policy.md)
- [Screenshots](docs/screenshots.md)
