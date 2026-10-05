# POS Mobile App — Build Guide (Waiter & Cashier)

A step-by-step plan for building the Expo mobile app on top of the existing web POS
(`C:\pos_system_ab\POS`). It covers the **Waiter** and **Cashier** roles only.

> **Ground rule:** the web POS codebase is **read-only**. The mobile app talks to the
> same `/api/*` endpoints the web app already uses. Anything that would need a backend
> change is listed under [Backend asks](#backend-asks-not-done--decide-later) for the
> team to decide on later — do not edit the POS repo while following this guide.

---

## 1. How the web POS works today

### 1.1 Roles and screens

| Role | Web home | Modules on the home screen |
|---|---|---|
| Waiter | `/t/{slug}/pos/waiter` | Dine-In, History |
| Cashier | `/t/{slug}/pos/cashier` | Takeaway, Dine-In, History |
| All Rounder | treated as Cashier (`middleware.ts`) | same as Cashier |

The waiter screens **reuse the cashier screens** with a `role` prop:

| Web file | Used by | Purpose |
|---|---|---|
| `pos/cashier/dinein/page.tsx` | both | Table floor, occupancy, takeaway pickup queue (cashier only) |
| `pos/_components/TableModal.tsx` | both | Table detail: status, **Add Order** tab, **Order List** tab, payments |
| `pos/_components/order.tsx` | both | Menu (categories → products → sizes) + cart |
| `pos/_components/PaymentModal.tsx` | both | Checkout, change calculation, receipt PDF |
| `pos/cashier/takeaway/page.tsx` | cashier | `order.tsx` with `orderType="TAKEAWAY"` |
| `pos/cashier/history/page.tsx` | both | Order history with date range |
| `pos/_components/SettingsDrawer.tsx` | both | Edit own name/email/password, theme toggle |

### 1.2 The core flows

**Dine-in (waiter or cashier)**
1. Open the tables screen → tap a table.
2. **Add Order** tab: choose items (+ size/variant, qty, note), optional customer name/phone →
   `POST /orders/dine-in`. The **server** calculates tax, creates the KOT ticket for the kitchen
   and marks the table `occupied`.
3. Kitchen moves the ticket `pending → preparing → ready`.
4. **Order List** tab: when food is `ready`, staff mark items/tickets `served`.
5. Payment: full (`POST /orders/{orderId}/payment`) or per-item partial
   (`POST /orders/{orderId}/partial-payment`).
6. After the bill is settled the table is set to `dirty` ("Cleaning"), then back to `available`.

**Takeaway (cashier)**
1. Build the cart → open payment → `POST /orders/takeaway` creates **and pays** the order in one call.
2. When the kitchen marks it `ready`, it appears in the **Takeaway Pickup Queue** on the cashier's
   Dine-In screen → cashier dismisses it (`PATCH /kot/{id}` → `served`).

### 1.3 Live updates

There are **no websockets**. The web app **polls every 5 seconds**: `GET /tables`, `GET /kot`,
and `GET /orders/{tableId}` while a table is open. The mobile app does the same with
React Query `refetchInterval`.

### 1.4 Status values

| Thing | Values |
|---|---|
| Table | `available`, `occupied`, `reserved`, `dirty` (shown as "Cleaning") |
| Order | `pending`, `preparing`, `ready`, `completed`, `cancelled` |
| KOT ticket / item | `pending`, `preparing`, `ready`, `served` (+ `cancelled` on order cancel) |
| Payment method | `cash`, `card`, `qr`, `yango`, `foodmandu`, `pathao` |
| Order type | `dine_in`, `takeaway` |

---

## 2. Authentication (read this before writing any code)

### 2.1 Login

`POST /api/auth/login` with `{ email, password }` returns:

```jsonc
{
  "accessToken": "…",            // JWT, 15 min, send as  Authorization: Bearer <token>
  "user": { "id", "name", "email", "isOwner", "organizationId", "slug" },
  "role": "Waiter" | "Cashier" | "All Rounder" | "Owner" | "Manager" | "Kitchen Crew" | null,
  "permissions": ["pos.billing.create", …],
  "outlets": [{ "id", "name" }], // active outlets only
  "activeOutletId": "…" | null,  // null when the user has >1 outlet
  "requiresOutletSelection": true | false
}
```

Errors: `401` invalid credentials, `403` email not verified / outlet inactive, `400` validation.
The body's `error` is either a string or a zod `flatten()` object — handle both.

### 2.2 Refresh token — the important catch

- The **refresh token is never in the JSON body**. It is only sent as an **httpOnly cookie**
  (`refreshToken`, 7 days), and `POST /api/auth/refresh` reads it **only from that cookie**.
- React Native's networking layer keeps cookies in the native cookie store (iOS `NSHTTPCookieStorage`,
  Android `CookieManager`), so sending requests with credentials **should** let refresh work
  without any backend change.
- `POST /api/auth/refresh` body: `{ activeOutletId }` → `{ accessToken, role, permissions }` and a
  new (rotated) cookie.
- In production the cookie is `secure`, so the API must be on **HTTPS**. In dev
  (`NODE_ENV=development`) plain HTTP works.

**Phase 1 must prove this works on a real Android and iOS device**, including after killing and
reopening the app. If it doesn't, fall back to "re-login when the access token expires" and raise
the backend ask below.

### 2.3 Outlet selection

If `requiresOutletSelection` is `true`, `activeOutletId` is `null` and every POS endpoint returns
`400 "No active outlet selected"`. The web app has **no outlet picker** (the fingerprint login links to a
`/select-outlet` page that doesn't exist). The mobile app can do it correctly:
show the `outlets` list → call `POST /auth/refresh` with `{ activeOutletId }` → store the new token,
role and permissions.

### 2.4 Other server rules

- **Suspended organisation:** any non-GET request returns `403` with a message. Show it, keep the
  app read-only.
- **Permissions** come from the token. Seeded defaults:
  - Waiter: tables read/update, KOT create/read/update, billing create/read/update, payments create/read, products read.
  - Cashier: same plus shift reports and bill splits (no KOT create).
- `GET /orders/{id}` takes a **table id**, not an order id (it returns the table's active orders).

---

## 3. API reference (Waiter & Cashier)

All paths are under `/api`. All need `Authorization: Bearer <accessToken>`.

| Method & path | Permission | Body / query | Response (key fields) |
|---|---|---|---|
| `POST /auth/login` | – | `{ email, password }` | see §2.1 |
| `POST /auth/refresh` | cookie | `{ activeOutletId }` | `{ accessToken, role, permissions }` |
| `POST /auth/logout` | cookie | – | revokes refresh token |
| `PATCH /auth/change-userDetail` | token | profile fields | `{ user }` |
| `GET /tables` | `restaurant.tables.read` | – | `{ tables: [{ id, tableNumber/name, status, shape, capacity, positionX, positionY }] }` |
| `PATCH /tables/{id}/status` | `restaurant.tables.update` | `{ status }` | – |
| `GET /categories` | token | – | `{ categories: [{ id, name, isActive, sortOrder }] }` |
| `GET /product` | token | `?categoryId=` (omit for all) | `{ products: [{ id, categoryId, name, price, imageUrl, isAvailable, isActive }] }` |
| `GET /product/{id}/variants` | token | `?outletId=` | `{ variants: [{ id, label, price, isAvailable }] }` |
| `GET /outlets/{id}` | token | – | `{ outlet: { taxEnabled, taxRate, … } }` |
| `POST /orders/dine-in` | `pos.billing.create` | `{ tableId, customerName?, customerPhone?, items: [{ productId, variantId?, quantity, notes? }] }` | `{ order: { id, orderNumber, … } }` |
| `POST /orders/takeaway` | `pos.billing.create` | `{ customerName?, customerPhone?, items: […], payment: { method, amountTendered } }` | created + paid order |
| `GET /orders/{tableId}` | `restaurant.tables.read` | – | `{ table, orders: [{ …, items: [{ product }], kotTickets }] }` |
| `DELETE /orders/{orderId}` | `pos.billing.update` | – | cancels order + its KOTs |
| `GET /orders` | token | `?startDate=&endDate=` or `?date=` | `{ orders: [{ …, items, payments, subtotal, tax, total }] }` |
| `POST /orders/{id}/payment` | `pos.payments.create` | `{ amount, method }` | `{ payment, order, totalPaid, balanceDue, changeDue }` |
| `GET /orders/{id}/partial-payment` | token | – | `{ status, taxRate, items: [{ orderItemId, productName, unitPrice, quantity, paidQty, unpaidQty, fullyPaid }] }` |
| `POST /orders/{id}/partial-payment` | token | `{ method, items: [{ orderItemId, quantity }], amountTendered }` | payment record |
| `GET /kot` | `restaurant.kot.read` | – | `{ tickets: [{ id, status, order: { orderNumber, orderType, customerName, table }, items: [{ id, status, orderItem: { quantity, notes, product } }] }] }` |
| `PATCH /kot/{ticketId}` | `restaurant.kot.update` | `{ status }` | – |
| `PATCH /kot/singlekot/{kotItemId}` | `restaurant.kot.update` | `{ status: "preparing" \| "ready" \| "served" }` | – |

> Shapes come from how the web client reads them. **Log the real response the first time you
> wire each endpoint** and write the TypeScript type from that, not from this table.

---

## 4. Things in the web code to be aware of

These are not bugs to fix now (the POS repo is read-only); the mobile app should just handle them.

1. **Refresh token is cookie-only.** See §2.2.
2. **No outlet picker on the web.** The mobile app should implement it (§2.3).
3. **All Rounder:** `middleware.ts` allows them into the cashier area but the cashier `layout.tsx`
   only allows `"Cashier"`. In the mobile app, treat `All Rounder` as Cashier.
4. **Tax display mismatch:** the cart (`order.tsx`) falls back to **8%** if the outlet can't be
   loaded, while the payment screen uses `taxEnabled ? taxRate : 0`. The **server** is the source of
   truth (it uses `taxEnabled`/`taxRate`). In the app, always use the `GET /outlets/{id}` rule and
   prefer totals returned by the server.
5. **N+1 product loading:** for every product the web calls `/product/{id}/variants`. On mobile,
   cache variants with React Query (long `staleTime`) and fetch them lazily when a product is
   tapped, not for the whole list.
6. **Table layout drag & drop** (positionX/positionY) is a desktop feature. The mobile app shows
   tables as a simple grid and **never writes positions**.
7. **Delivery-platform payments** (`yango`, `foodmandu`, `pathao`): the amount entered is the
   platform price and is saved as the order total.

---

## 5. Step-by-step build plan

Each phase ends with a **Done when** checklist. Don't start the next phase until it passes.

### Phase 0 — Project setup ✅ partly done

Already in the app: Expo SDK 57, NativeWind v4 with the POS colour theme (`global.css`,
`tailwind.config.js`), Redux Toolkit, React Query, safe-area context, a login UI
(`src/screens/LoginScreen.tsx`).

Remaining:
1. Read the Expo SDK 57 docs before adding packages (see `AGENTS.md`), and always install with
   `npx expo install <pkg>` so versions match the SDK.
2. Add navigation: **expo-router** (file-based, Expo's default).
3. Add `expo-secure-store` (token storage) and `axios` (to mirror the web `src/lib/api.ts`).
4. Add an `.env` with `EXPO_PUBLIC_API_URL`. A phone can't reach `localhost` — use your PC's LAN IP
   in dev (e.g. `http://192.168.1.20:3000/api`) and the HTTPS URL in production.
5. Folder layout:

```
app/                      # expo-router routes
  (auth)/login.tsx
  (auth)/select-outlet.tsx
  (waiter)/index.tsx      # home
  (waiter)/tables.tsx
  (waiter)/table/[id].tsx
  (waiter)/history.tsx
  (cashier)/index.tsx
  (cashier)/takeaway.tsx
  (cashier)/tables.tsx
  (cashier)/table/[id].tsx
  (cashier)/history.tsx
  unsupported-role.tsx
src/
  api/        client.ts, auth.ts, tables.ts, menu.ts, orders.ts, kot.ts, payments.ts
  hooks/      useTables.ts, useKot.ts, useMenu.ts, useTableOrders.ts, useHistory.ts …
  store/      authSlice.ts (user, role, permissions, outletId)
  components/ shared UI (FormField, TableCard, MenuItem, CartSheet, StatusBadge …)
  screens/    screen bodies shared by waiter and cashier routes
  types/      api.ts
```

**Done when:** the app starts on a device, reads `EXPO_PUBLIC_API_URL`, and navigates between two
placeholder routes.

### Phase 1 — API client & authentication

1. `src/api/client.ts`: axios instance with `baseURL = EXPO_PUBLIC_API_URL`, `withCredentials: true`.
   - Request interceptor adds `Authorization: Bearer <token>`.
   - Response interceptor: on `401` (except `/auth/login`) call `/auth/refresh` with
     `{ activeOutletId }` **once**, queue other requests while refreshing (copy the web's
     `isRefreshing` + `refreshQueue` pattern), retry; if refresh fails → clear session → login.
2. Session storage: access token, `user`, `role`, `permissions`, `activeOutletId` in
   `expo-secure-store`; mirror them in the Redux `authSlice`.
3. Wire `LoginScreen` → `POST /auth/login`. Show the server's `error` string.
4. After login:
   - `requiresOutletSelection` → `select-outlet` screen → `/auth/refresh` with the chosen id.
   - Route by role: `Waiter` → `(waiter)`; `Cashier`/`All Rounder` → `(cashier)`;
     anything else → `unsupported-role` ("Use the web app for this role") with a logout button.
5. App start: if a session is stored, call `/auth/refresh` to validate it, then route by role.
6. Logout: `POST /auth/logout`, clear storage, go to login.
7. Global error handling: `403` suspended-org message as a banner; network errors as a retry toast.

**Done when:**
- [ ] Waiter and cashier test accounts land on their own home screens.
- [ ] After 15+ minutes (or a manually expired token), a request still succeeds via refresh.
- [ ] Killing and reopening the app keeps you logged in (proves the cookie persists) — on **both**
      Android and iOS.
- [ ] A multi-outlet user can pick an outlet and API calls work.
- [ ] Logout really logs out (reopening the app shows login).

### Phase 2 — Shared data layer

Build React Query hooks once; both roles use them.

| Hook | Endpoint | Refresh |
|---|---|---|
| `useTables()` | `GET /tables` | `refetchInterval: 5000` |
| `useKotTickets()` | `GET /kot` | `refetchInterval: 5000` |
| `useTableOrders(tableId)` | `GET /orders/{tableId}` | 5 s while the screen is focused |
| `useCategories()` | `GET /categories` | `staleTime` 5 min |
| `useProducts(categoryId)` | `GET /product` | `staleTime` 1 min |
| `useVariants(productId)` | `GET /product/{id}/variants?outletId=` | `staleTime` 5 min, lazy |
| `useOutlet()` | `GET /outlets/{activeOutletId}` | `staleTime` 10 min |
| `useOrderHistory(range)` | `GET /orders?startDate&endDate` | on demand |
| `usePaymentStatus(orderId)` | `GET /orders/{id}/partial-payment` | on open |

Mutations: `createDineInOrder`, `createTakeawayOrder`, `payOrder`, `payPartial`, `cancelOrder`,
`setTableStatus`, `setKotStatus`, `setKotItemStatus`. Each one invalidates the related queries.

Also:
- Pause polling when the app is in the background (React Query `focusManager` + `AppState`).
- Map server values to UI labels in one place (`dirty` → "Cleaning", `ready` → "Ready", etc.).
- Money: show `Rs.` with 2 decimals; do the maths in paisa (×100) and round like the web
  (`Math.round(x * 100) / 100`).

**Done when:** a debug screen lists tables, categories and products for the logged-in outlet and
tables refresh on their own when changed from the web app.

### Phase 3 — Waiter app

**3.1 Home** — "Welcome back", two big cards: **Dine-In**, **History**; header settings button;
logout. (No fullscreen button — not needed on mobile.)

**3.2 Tables** (`tables.tsx`)
1. Summary bar: occupied / total and occupancy %.
2. Grid of table cards (2–3 columns): label, seats, status colour (available green, occupied red,
   reserved blue, cleaning gold), and a **"Food ready"** badge when the table is occupied and has a
   `DINE_IN` ticket in `ready` state (same rule as `checkTableReadyState` in the web).
3. Optional filter chips by status. Pull-to-refresh.
4. Tap → table detail.

**3.3 Table detail** (`table/[id].tsx`) — mirrors `TableModal`:
1. Header: table label, status chip, status buttons (available / reserved / cleaning). Disable
   "cleaning" while the table still owes money (web rule).
2. **Add Order** tab — the menu:
   - Horizontal category chips (+ "All"), product list/grid with image, price, unavailable state.
   - Tapping a product with more than one variant opens a size picker (bottom sheet).
   - Cart as a bottom sheet: qty +/−, per-item note, customer name/phone (optional), subtotal,
     tax (from `useOutlet`), total.
   - **Send to kitchen** → `POST /orders/dine-in` → toast → switch to Order List.
3. **Order List** tab:
   - Each active order: number, time, items with status (Pending / Preparing / Ready / Delivered).
   - Toggle an item **served** → `PATCH /kot/singlekot/{kotItemId}` (fall back to
     `PATCH /kot/{ticketId}` when the item has no KOT item id — same as the web).
   - Cancel order (confirm dialog) → `DELETE /orders/{orderId}`; if it was the last order the web
     sets the table back to `available`.
   - Payment buttons: show them only if the user has `pos.payments.create` (waiters do by default;
     confirm with the restaurant whether waiters should collect payment on mobile).

**3.4 History** — date range (today by default), list of orders with number, type, table/customer,
total, payment badge; tap to expand items, subtotal, tax, total.

**3.5 Settings sheet** — name/email/password change (`PATCH /auth/change-userDetail`), theme
toggle (`colorScheme.set` from NativeWind), app version, logout.

**Done when:**
- [ ] A waiter places a dine-in order on the phone and it appears on the web kitchen board.
- [ ] When the kitchen marks it ready, the phone shows "Food ready" within ~5 s.
- [ ] The waiter marks items delivered and the web reflects it.
- [ ] Cancel works and frees the table.
- [ ] History shows today's orders.

### Phase 4 — Cashier app

Reuse everything from Phase 3; only add what's different.

**4.1 Home** — three cards: **Takeaway**, **Dine-In**, **History**.

**4.2 Takeaway** (`takeaway.tsx`)
1. Same menu + cart component as dine-in, `orderType = TAKEAWAY`, customer name/phone.
2. **Checkout** opens the payment sheet (4.4) → `POST /orders/takeaway` with
   `payment: { method, amountTendered }` — one call creates and pays the order.
3. Success screen: order number, change due, **Share receipt** (Phase 5), **New order**.

**4.3 Dine-In** — the Phase 3 tables screen plus:
- **Takeaway Pickup Queue** at the top: tickets where `type = TAKEAWAY` and state is ready. Tap
  to expand items, **Picked up** → confirm → `PATCH /kot/{ticketId}` `{ status: "served" }`.
- Table detail gets the **Pay bill** flow (4.4) for all unpaid orders on the table.

**4.4 Payment sheet** — mirrors `PaymentModal`:
1. Show items, already-paid items (from `GET /orders/{id}/partial-payment`), subtotal, tax, total.
2. Methods: Cash, Card, QR, Yango, Foodmandu, Pathao.
3. Cash: numeric "cash received" input, quick-amount buttons, live **change** = received − total;
   disable Pay until received ≥ total.
4. Delivery platforms: amount field = platform price (saved as order total; must be > 0).
5. Dine-in with several open orders: pay them one by one with `POST /orders/{id}/payment`, splitting
   cash across orders like the web (`min(cashLeft, orderTotal)` per order).
6. If everything was already paid through partial payments, skip charging and go straight to the
   receipt (web behaviour).
7. After success → set table to `dirty` (Cleaning).

**4.5 Partial (per-item) payment** — from the Order List, "Pay item": pick qty of an unpaid item,
method, amount → `POST /orders/{id}/partial-payment`. Refresh payment status afterwards.

**4.6 History** — same as the waiter, cashier back button goes to cashier home.

**Done when:**
- [ ] A takeaway order is placed and paid on the phone and shows in web history with the right method.
- [ ] Cash change is correct; pay is blocked when cash is short.
- [ ] Ready takeaways show in the pickup queue and can be dismissed.
- [ ] A dine-in bill with two orders is settled; the table goes to Cleaning, then Available.
- [ ] A per-item partial payment then a final payment add up to the server total.

### Phase 5 — Receipts & polish

1. Receipt: build the same layout as the web receipt as HTML → `expo-print` (`printToFileAsync`)
   → `expo-sharing`. (Bluetooth thermal printers are a separate later task.)
2. Loading skeletons, empty states ("No tables yet"), offline banner.
3. Haptic feedback on add-to-cart and payment success (`expo-haptics`).
4. Keep the screen awake on the tables screen (`expo-keep-awake`) — staff leave it open.
5. Accessibility: 44 pt minimum touch targets, labels on icon buttons.

### Phase 6 — Testing & release

1. Test accounts: the POS seeds create demo users (`npm run db:seed:dev` for owner/cashier,
   `npm run db:seed:waiter-kitchen` for waiter/kitchen). Run them on a **dev database only**.
2. Test matrix — every Done-when list above, on one Android and one iOS device, in light and dark
   mode, on slow network (Android emulator network throttling).
3. Concurrency: web cashier + phone waiter on the same table at the same time.
4. Build with **EAS Build**; set the production `EXPO_PUBLIC_API_URL` (HTTPS) in EAS env.
5. Update `app.json`: real `name`, `slug`, bundle id / package, icon, splash, and
   `userInterfaceStyle: "automatic"` (currently `"light"`).

---

## Backend asks (not done — decide later)

None of these are required to start. They would make the mobile app more robust.

| # | Ask | Why |
|---|---|---|
| 1 | Return `refreshToken` in the login/refresh JSON and accept it in the body or a header (e.g. when `X-Client: mobile` is sent) | Removes the dependency on native cookie storage (§2.2) |
| 2 | Add a `POST /auth/select-outlet` (or document `refresh` as the outlet switch) and verify the user belongs to that outlet | Outlet picker for multi-outlet staff (§2.3) |
| 3 | Return variants inside `GET /product` | Removes N+1 calls on the menu screen |
| 4 | Websocket/SSE or Expo push for "food ready" | Replaces 5 s polling, saves battery |
| 5 | Allow `All Rounder` in the web cashier `layout.tsx` | Consistency with `middleware.ts` |

---

## Order of work (summary)

1. Phase 0 — finish setup (router, secure store, axios, env).
2. Phase 1 — auth end-to-end, **prove refresh-cookie persistence on real devices**.
3. Phase 2 — React Query hooks with 5 s polling.
4. Phase 3 — Waiter: home → tables → table detail (menu, cart, order list) → history → settings.
5. Phase 4 — Cashier: home → takeaway + payment → dine-in + pickup queue + bill payment → partial pay → history.
6. Phase 5 — receipts and polish.
7. Phase 6 — test on devices, EAS build, release.
