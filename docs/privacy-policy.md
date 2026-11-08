# Privacy Policy Draft

Last updated: 2026-11-08

Ryans Stock Checker is an independent browser extension for showing store stock availability while browsing Ryans Computers product and category pages.

This extension is not affiliated with, endorsed by, or produced by Ryans Computers.

## Data Stored Locally

The extension stores only settings needed for its stock display:

- the selected Ryans area (zone) and the shops chosen in that area;
- the list of Ryans areas and shops, as last read from Ryans.

This data is stored in Chrome local storage on the user's device.

Stock results for products already checked are kept in Chrome's in-memory session storage for 5 minutes, so revisiting a page doesn't repeat requests. They are cleared when the browser closes.

## Data Sent To Ryans

To show stock, the extension requests `https://www.ryans.com/zones-availabiliy/{zone}/{product code}` for each product card on Ryans category and search pages. These requests contain only the selected area's ID and the product code shown on the card.

When choosing shops, the settings page also loads one Ryans search page and one product page to read the current list of areas.

These requests go to Ryans the same way Ryans' own "Check Availability" button does, so Ryans receives them with the browser's normal headers and cookies.

The extension does not send this data to the extension developer.

## Data Not Collected

The extension does not collect personal information, sell data, serve ads, use affiliate links, or track users across unrelated websites.

The extension does not include analytics, remote logging, advertising SDKs, or external trackers.

## Permissions

The extension requests:

- `storage`, to save the selected Ryans area and shops, and briefly cache stock results in memory;
- `https://www.ryans.com/*`, to show stock on Ryans category and search pages and to request stock and area data from Ryans.

## Third-Party Dependency

Stock data comes from Ryans responses. Stock checks may fail or become unavailable if Ryans changes, blocks, or removes the endpoints used by this extension.

## Contact

Add support email or support URL before publishing.
