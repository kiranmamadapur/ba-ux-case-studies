# QuickBite prototype

A working browser app for the QuickBite concept project (fictional restaurants, riders and orders, simulated clock). Open `index.html` in a browser, or serve the repo with GitHub Pages. No build step, no network calls.

Open it in **two tabs** to be the customer in one and the restaurant in the other. Changes sync between tabs.

Run the rule tests (Node 18 or later): `node --test` in this folder.

## What is real and what is simulated

| Real in this prototype | Simulated or not built |
|---|---|
| Customer: menu, cart, item notes, order, live tracking on a map with an arrival time that is recomputed | Restaurants, menus, riders and the map are fictional. The map is a drawing, not real streets |
| Restaurant tablet: new-order queue with a sound alert and a visual flash, accept with prep time, reject with a refund record | The sound needs one tap to switch on (browser rule). No payment or refund moves any money |
| Rider: the nearest free rider is assigned by distance. If none is free the order waits | Rider positions are simulated. There is no GPS |
| Manager dashboard: order-to-door time, accuracy and cancelled orders from the orders in this browser | The sample day is flagged as sample data. Targets in the case study are assumptions. No UAT has been run |
| Location refresh every 10 simulated seconds, with 1x, 6x and 30x speed controls | The clock is simulated, so you do not wait real minutes |
| Data is saved in `localStorage` under `qb:v2` with a schema version | Not encrypted. No sign-in: roles are a switcher |

## Files

| File | Purpose |
|---|---|
| `logic.js` | Pure business rules (no DOM). Loaded as `window.QB` in the browser and with `require` in Node |
| `logic.test.js` | 28 `node:test` tests for the rules |
| `app.js` | State, rendering, role switcher, simulated clock, cross-tab sync |
| `index.html`, `extra.css` | Page and styles. Shared base styles come from `../../shared/` |

## Traceability

| Requirement | Where it is built | Tests |
|---|---|---|
| FR1 Place an order with item notes | `validateCart`, `placeOrder`; Customer view | FR1 tests, UA1 |
| FR2 Restaurant accepts and sets prep time | `acceptOrder`, `rejectOrder`; Restaurant view | FR2 test, AC2 |
| FR3 Assign nearest available rider | `nearestFreeRider`, `dispatchWaiting`, `riderTask`; Rider view | FR3 tests |
| FR4 Live tracking with honest arrival time | `etaSeconds`, `trackView`, `tick`; tracking card and map | AC1, FR4 tests |
| NFR Tracking location refreshes every 10 seconds | `TRACK_REFRESH_S`, `tick`, `advanceWall` | NFR1 tests |
| NFR Restaurant screen readable at arm length | Large type in `extra.css` | not testable here |

### Acceptance criteria

1. Rider assigned, map and arrival time update: AC1.
2. New order, tablet alerts and shows items: AC2.
3. Day of orders, dashboard shows average order-to-door time: AC3.

### UAT scenarios

1. Order with a note, note visible to the restaurant: UA1.
2. Reject an order, customer notified and refunded: UA2.
3. Open the dashboard, order-to-door time shown: UA3.

### Other behaviour covered

The arrival time never drops below the remaining prep time plus the ride to the customer. Accuracy counts only orders the customer confirmed. With no orders the dashboard says there is no data instead of showing zeros. Old or corrupt saved data falls back to fresh state.

## Not verified

Screen-reader behaviour and keyboard-only use were not tested by a person. Contrast and the arm's-length readability of the restaurant screen were not measured. A headless Chromium run at 360px width placed an order in one tab and saw it in the restaurant queue in a second tab, with no console errors. The sound alert was not heard.
