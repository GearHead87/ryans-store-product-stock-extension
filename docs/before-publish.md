# Before Publish Checklist

This checklist is for publishing this extension to the Chrome Web Store.

Official references:

- Chrome Web Store publish flow: https://developer.chrome.com/docs/webstore/publish
- Chrome Web Store best practices: https://developer.chrome.com/docs/webstore/best-practices
- Chrome Web Store image requirements: https://developer.chrome.com/docs/webstore/images
- Chrome Web Store program policies: https://developer.chrome.com/docs/webstore/program-policies/policies

## Must Do Before Submission

### 1. Resolve Ryans API Permission And Credential Risk

- [ ] Confirm we are allowed to use the Ryans endpoints from a public browser extension.
- [ ] Confirm no private credential is embedded in the extension code; if one is required, move API access behind our own backend/proxy.
- [ ] Document the API dependency in the store listing: stock data comes from Ryans and may be unavailable if Ryans changes or blocks the endpoint.

Reason: Chrome extensions are public artifacts. Any credential shipped in the extension package can be extracted.

### 2. Handle Ryans Branding And Affiliation Clearly

- [ ] Decide whether the extension name can safely use `Ryans`.
- [ ] Do not use the Ryans logo, icons, or brand assets unless we have permission.
- [ ] Add an explicit unaffiliated disclaimer in the store description, for example:

```text
This extension is an independent tool and is not affiliated with, endorsed by, or produced by Ryans Computers.
```

Reason: Chrome Web Store policy does not allow impersonation, false endorsement, misleading metadata, or intellectual property infringement.

### 3. Finalize Manifest Metadata

- [ ] Update `package.json` `version` from `0.0.1` to a real release version such as `1.0.0`.
- [ ] Confirm `package.json` `description` matches the current behavior.
- [ ] Confirm the generated manifest is Manifest V3.
- [ ] Confirm extension name, short description, and long description accurately match the current behavior.

### 4. Review Permissions

Current permissions:

```json
"permissions": ["storage"],
"host_permissions": ["https://www.ryans.com/*"]
```

- [ ] Keep only the permissions we actually need.
- [ ] Be ready to explain `storage`: saves the user's selected default Ryans store.
- [ ] Be ready to explain `https://www.ryans.com/*`: injects UI into Ryans product/category pages.
- [ ] Be ready to explain any Ryans API host permission added later.
- [ ] Confirm no broad permissions such as `tabs`, `activeTab`, `cookies`, or `<all_urls>` are added.

### 5. Privacy Disclosure And Privacy Policy

- [ ] Fill out the Chrome Web Store Privacy tab accurately.
- [ ] Create and host a privacy policy URL if the dashboard requires it.
- [ ] Update `docs/privacy-policy.md` so it matches the implementation.
- [ ] State that we do not sell data, do not use data for advertising, and do not track users across unrelated sites.
- [ ] Confirm no analytics, remote logging, advertising, affiliate links, or external trackers are present.

### 6. Store Listing Assets

- [ ] Replace the placeholder `assets/icon.png` with a final icon that looks good on light and dark backgrounds.
- [ ] Prepare at least 1 required screenshot (see `docs/screenshots.md`).
- [ ] Prefer 4-5 screenshots showing product page, category page, settings page, and unavailable/error state.
- [ ] Prepare promotional image assets if we want better store presentation.
- [ ] Do not include misleading screenshots or mocked capabilities.

### 7. Manual Test Matrix

Test against real Ryans pages before submission.

- [ ] Product page.
- [ ] Category page.
- [ ] Category page with and without a default store selected.
- [ ] Options page can load and save the default store.
- [ ] Extension icon opens the options page.
- [ ] API failure or offline network shows a non-breaking unavailable state.
- [ ] Navigation between Ryans pages refreshes extension UI correctly.
- [ ] Reloading the page does not duplicate stock blocks.

### 8. Build And Package Verification

- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `pnpm package`
- [ ] Load the packed extension from `chrome://extensions` and test it, not only the dev server.
- [ ] Inspect the generated ZIP contents before upload.

### 9. Chrome Web Store Submission Fields

- [ ] Register and complete the Chrome Web Store developer account.
- [ ] Upload the ZIP package in the Developer Dashboard.
- [ ] Fill Store Listing: name, descriptions, category, language, screenshots, icons/promotional images.
- [ ] Fill Privacy: single purpose, permission justifications, data handling answers, privacy policy URL if needed.
- [ ] Fill Distribution: target regions, visibility, pricing/payment status.
- [ ] Provide reviewer test instructions.

## Publish Gate

Do not submit until these are complete:

- [ ] API/credential permission is resolved.
- [ ] Branding and unaffiliated wording are resolved.
- [ ] Privacy disclosure is written and matches implementation.
- [ ] Store screenshots and icon assets are ready.
- [ ] `pnpm typecheck`, `pnpm build`, and `pnpm package` pass.
- [ ] Packed extension has been manually tested on real product and category pages.
