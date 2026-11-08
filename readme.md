# Ryans Stock Checker

Chrome extension that shows Ryans Computers (https://www.ryans.com) store stock availability on product pages and category product cards.

## Tech stack

- [Plasmo](https://www.plasmo.com/) (Chrome MV3)
- React 18 + TypeScript
- zustand for settings state

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
