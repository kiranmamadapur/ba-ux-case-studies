# UrbanThread app (concept)

A working multi-view shopping app for the UrbanThread case study: shop with search and filters, product detail, wishlist, bag, 3-step guest checkout, order tracking and a small KPI panel. It runs in the browser with no build step and no network.

**Run it:** open `index.html`, or serve the repo with GitHub Pages. **Test it:** `node --test` in this folder (Node 18+, no installs).

## Real and simulated

| Real (works as built) | Simulated |
|---|---|
| Filtering, search, sort, stock rules, bag maths, checkout validation, stock decrement, order ids, persistence in `localStorage` (`ut:v2`), keyboard and screen-reader behaviour | The brand, products, prices and stock are fictional. No payment, email, address lookup or server. Tracking statuses advance on a demo clock (1 real minute = 1 simulated hour). The KPI panel counts only your own actions in this browser, so it is not business data. No UAT has been run with real users. |

## Files

| File | Purpose |
|---|---|
| `logic.js` | Pure business rules (no DOM). Exposed as `window.UT` and `module.exports`. |
| `app.js` | State, rendering and events. |
| `index.html`, `extra.css` | Page and styles on top of `../../shared/style.css`. |
| `logic.test.js` | 18 tests with `node:test`. |

## Traceability to the case study

| Item | Requirement | Where it lives | Test |
|---|---|---|---|
| FR1 | Apply and clear several filters in one sheet | `filterProducts`, filter sheet in `app.js` (`sheet`, `apply`, `clearf`) | AC1, UAT1, FR1 |
| FR2 | Wishlist without signing in | `toggleWishlist`, `heart` | FR2 |
| FR3 | Guest checkout with address autofill | `validateCheckout`, `placeOrder`, `lastAddress`, checkout steps | AC2, UAT2, FR3 (x2) |
| FR4 | Order tracking with status steps | `trackingSteps`, Orders view | AC3, UAT3 |
| AC1 | Two filters, tap Apply, results update and count shows | Live "Show N items" in the sheet and `#count` | AC1 |
| AC2 | No account, reach payment, complete with email only | Guest checkout, no password field | AC2 |
| AC3 | Shipped order shows each status step with its date | Order steps list with a date on every step | AC3 |
| UAT1 | Size and price filters together, matching items only | as AC1 | UAT1 |
| UAT2 | Guest checkout, order confirmed | Confirmation view | UAT2 |
| UAT3 | Tracking steps match the order | `trackingSteps` | UAT3 |
| NFR1 | Filter results under 1 second | Synchronous in-memory filter | NFR timing test |
| NFR2 | Primary buttons at least 44px tall | `min-height:44px` in shared CSS, `extra.css` | Checked by eye, not automated |

## Accessibility

Skip link, labelled controls, `aria-pressed` on toggles, `aria-live` for counts, errors and toasts, visible focus, errors tied to fields with `aria-describedby`, `prefers-reduced-motion` respected. Checked at 360px width in a headless browser with no horizontal overflow. A full WCAG audit has not been done.

## Known limits

The header gradient comes from the shared stylesheet and its contrast was not re-measured. Stock is per browser, so two visitors do not share it.
