# Stock Out Rebuild — Slice 1: Party Master & Shell

Date: 2026-09-28
Status: Approved (architecture), pending spec review

## Why

Stock Out today is a single screen that deducts stock by *quantity per colour variant*
(`stockOut.validator.js`). The approved prototype replaces it with a four-screen workflow —
Overview, Order Forms, Invoices, Party Master, plus a Gallery — in which dispatch is driven by
scanning the QR tag on each physical set or piece. The existing `modules/order/` order-form
module is superseded by the prototype's own order forms and is removed as part of this work.

This document specifies **slice 1 only**: the Party Master master-data module and the Stock Out
shell that the later slices hang off. Slices 2–4 (Order Forms, Invoices, Gallery) each get their
own spec.

## Scope of slice 1

In scope:

- `parties` table, API, and Party Master screen (list, search, create, edit)
- Stock Out shell: subnav layout, role context, Overview screen with live statistics
- Removal of the old Stock Out page, the backend stock-out module, and `modules/order/`
- A migration that back-fills parties from existing `order_forms.retailer_name` values

Out of scope (later slices): order forms, invoices, stock deduction, gallery, printing, CSV.

## Decisions carried in from brainstorming

| Decision | Choice |
|---|---|
| Removal scope | Full rebuild — old Stock Out page, stock-out API, and `modules/order/` all deleted |
| Sequencing | Party → Orders → Invoices → Gallery, one spec each |
| Roles | Client-side Staff/Owner toggle; backend enforces via request header |
| Party fields | The prototype's six, with existing retailers migrated |
| UI | Rebuilt in Tailwind + shadcn/ui, not a CSS port |
| Navigation | Subnav under `/stock-out`; Gallery its own sidebar item; old Sales → Order Forms entry removed |
| Document numbers | Typed by hand to match the physical book, validated unique (not derived from row id) |

## Data model

### `parties`

| Column | Type | Notes |
|---|---|---|
| `id` | identity PK | |
| `name` | varchar(200) NOT NULL | as typed, preserving case |
| `normalized_name` | varchar(200) NOT NULL | trim + lowercase, computed in the repository |
| `mobile` | varchar(20) | |
| `city` | varchar(100) | |
| `gst` | varchar(20) | |
| `transport` | varchar(200) | |
| `agent` | varchar(100) | |
| `is_active` | boolean NOT NULL default true | soft delete; parties are referenced by documents |
| `created_at` / `updated_at` | timestamp | `$onUpdateFn` for updated_at |

`uniqueIndex parties_normalized_name_unique_idx (normalized_name)` — the same pattern
`color_variants` uses for colour names. Two parties cannot share a name, which is what makes the
prototype's "is this an existing party or a new one?" autocomplete decidable.

Only the six prototype fields, plus `name`, are user-facing. `mobile`, `city`, `gst`,
`transport` and `agent` are all nullable: the prototype's party form marks only the name
required, and a counter clerk noting a walk-in customer will not always have a GST number.

### Why documents will snapshot the party (relevant now, used in slices 2–3)

`order_forms` and `invoices` will each carry both `party_id` and a frozen six-column copy of the
party's details at the time the document was saved. A printed invoice must keep saying what it
said when it was printed; editing a party's transport six months later must not silently rewrite
history. The prototype models this explicitly — its "Update Party Master?" dialogue asks whether
a change applies to just this document or to the master record — and that dialogue is only
meaningful if documents hold their own copy.

Slice 1 creates no document tables. It only fixes the rule so slices 2–3 do not have to
relitigate it.

## Backend

New module `backend/src/modules/sales/`, following the shape every other module already uses
(controller → service → repository → schema, validators in `validators/`, routes described as
data for `routeBuilder.js`):

```
modules/sales/
  schemas/party.schema.js
  repositories/party.repository.js
  services/party.service.js
  controllers/party.controller.js
  validators/party.validator.js
  routes/party.route.js
  mapper/partyMapper.js
```

### Endpoints

Mounted at `/api/v1/parties` from `app/routes/index.js`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/parties` | list; `?q=` searches name, mobile, city and GST; `?page=`/`?limit=` paginate |
| GET | `/parties/summary` | counts for the Overview tile; declared before `/:id` so "summary" is not parsed as an id |
| GET | `/parties/:id` | one party |
| POST | `/parties` | create; 409 `PARTY_NAME_EXISTS` on a duplicate normalized name |
| PUT | `/parties/:id` | update; same duplicate check, excluding itself |
| PATCH | `/parties/:id/status` | soft delete / restore via `isActive` |

Responses use `ApiResponse`, errors `ApiError` with a machine-readable code, and the list
endpoint returns `{ data, meta }` exactly as `listOrderForms` does today.

Validation is Zod in `party.validator.js`: name required, trimmed, 1–200 chars; the rest
optional and trimmed; mobile and GST accept whatever the user types (the prototype's own sample
data uses spaced mobiles like `98250 11210`, so imposing a format would reject real input).

### Role enforcement

A small `role.middleware.js` under `app/middlewares/` reads an `X-User-Role` header, defaults to
`staff` when absent or unrecognised, and attaches `req.userRole`. A `requireOwner` guard rejects
with 403 `OWNER_ONLY`.

Slice 1 adds the middleware and applies it to nothing — no party operation is owner-only. It
exists now so slice 3's invoice-edit endpoint has a guard to reach for, and so the stand-in has
exactly one place to be replaced when real auth arrives.

Documents will stamp a `prepared_by` varchar from this role. `stock_history.performed_by` stays
null: its schema comment says never to fabricate a value there, and a role name is not a user id.

## Migration

One hand-written SQL file, `0006_add_parties.sql`, matching the existing numbered convention:

1. `CREATE TABLE parties` with the unique index
2. Insert one party per distinct normalized `retailer_name` from `order_forms`. `name` comes from
   the retailer name as typed on that retailer's most recent order form, and `city` from that
   row's `location`. `contact_person` is dropped: parties have no equivalent field, and the
   prototype's six fields do not include one. `mobile`, `gst`, `transport` and `agent` are left
   null for migrated parties — the old table never held them. Distinctness is on the normalized
   name, so `Meera Textiles` and `meera textiles ` collapse into one party
3. `ALTER TABLE ... RENAME TO legacy_order_forms` / `legacy_order_form_items` /
   `legacy_order_form_photos`, leaving their enums in place.

Renaming rather than dropping is deliberate. The application stops referencing these tables the
moment `schema.js` drops their exports, so a rename is functionally identical to a drop from the
code's point of view — but it is reversible, and it means a wrong assumption about what data
matters in that database is recoverable rather than fatal. A later migration can drop the
`legacy_` tables once the rebuild has been running in production long enough to be trusted.

Step 2 runs before step 3 deliberately: the retailer names are only recoverable while the old
table still exists. If `order_forms` is empty the insert is a no-op and the migration still
succeeds.

`schema.js` drops its three `modules/order/...` exports and adds the parties export.

## Removals

Backend:

- `modules/order/` (15 files) and its route mount
- `modules/stock/{controllers,services,validators,mapper}/stockOut*` — the quantity-based
  deduction path, superseded by slice 3's scan-based one
- `stock_out_transactions` / `stock_out_entries` tables and repositories are **kept**: slice 3
  will write to them, and `stock_history.stock_out_transaction_id` references them

Frontend:

- `features/inventory/pages/StockOut.jsx` and its `useStockOutRegisterApi`,
  `useVariantStockOutConfigs`, `stockOut.api.js`
- `features/orderForms/` (24 files)
- The `/order-forms*` routes from `App.jsx` and the Sales → Order Forms entry from
  `getMenuList.js`

The prototype has no equivalent of the old module's public share link
(`/order-forms/share/:orderFormNumber`) or its photo uploads. Both are removed; the Gallery in
slice 4 covers the "send designs to the client" need those features served, sourcing photos from
`color_variants.image_url` rather than a per-document upload. Uploaded photo rows survive in
`legacy_order_form_photos` (and the files themselves in Cloudinary), so nothing is unrecoverable
if that call turns out to be wrong.

## Frontend

New feature folder `features/sales/`, replacing `features/orderForms/`:

```
features/sales/
  layouts/StockOutLayout.jsx      subnav + role switch, renders <Outlet />
  context/RoleContext.jsx         role state, persisted to localStorage
  pages/Overview.jsx
  pages/Parties.jsx
  components/PartyFormDialog.jsx
  components/PartyPicker.jsx      autocomplete; unused in slice 1, built for slices 2-3
  services/party.api.js
  hooks/useParties*.js
```

Routes, nested under `MainLayout`:

| Route | Screen |
|---|---|
| `/stock-out` | Overview |
| `/stock-out/parties` | Party Master |
| `/stock-out/orders`, `/stock-out/invoices` | placeholder panels naming the slice that fills them |

The two placeholders exist so the subnav is never broken between slices.

`RoleContext` holds the role and a `fetchWithRole` wrapper that attaches `X-User-Role`. Every
service in later slices goes through it, so no call site has to remember the header.

### Screens

**Overview.** The prototype's two action cards (New Order Form, New Invoice) and its four-step
flow strip, plus one live statistic: the number of saved parties.

The prototype's other four tiles — open order forms, invoices this month, pieces dispatched, value
invoiced — are deferred to slice 2, because slice 1 creates no document tables for them to count.
Rendering them as zeros would be a screen that lies. The action cards route to the slice
placeholders. The recent-documents tables are likewise deferred to slice 2.

**Party Master.** `TablePageLayout` + `DataTable`, matching Designs and Current Stock. Search
box debounced with the existing `useDebouncedValue`. Create/edit through a dialog built on
`ActionModal`/`ModalProvider`, showing the duplicate-name error inline against the name field
rather than as a toast, because that is the error the user can actually fix in place.

**PartyPicker.** The prototype's autocomplete: type a name or mobile, pick a saved party to fill
every field, keyboard navigable, and a badge stating whether the form is filled from Party
Master, holds unsaved changes against it, or describes a party that will be created. Built in
slice 1 alongside the API it depends on, consumed in slices 2–3.

## Error handling

- Duplicate party name → 409 `PARTY_NAME_EXISTS`, surfaced inline on the name field
- Party not found → 404 `PARTY_NOT_FOUND`
- Validation failure → the existing `validateRequest` 400 shape, unchanged
- Owner-only route hit by staff → 403 `OWNER_ONLY` (no such route yet in slice 1)
- Network/server failure in the UI → react-query error state plus the app's toast, as elsewhere

The service layer normalises and checks names inside the same transaction as the insert, so two
concurrent creates cannot both pass the check; the unique index is the backstop and its
violation is translated to the same 409.

## Testing

The repository has no test runner and no tests. This slice therefore proposes adding **Vitest**
to the backend and testing the party service and routes with Vitest + Supertest against a test
database.

Rationale, and why it belongs here rather than later: slice 3 deducts real stock inside a
transaction from scanned tags. That is the highest-risk code in the application, and it is far
cheaper to stand up a test harness now, on a CRUD module where the tests are obvious, than to
retrofit one around the invoice logic. Slice 1's tests are worth little on their own; the harness
they establish is the point.

Coverage in slice 1:

- Party service: create, duplicate rejection (exact, case-differing, whitespace-differing),
  update, self-excluding duplicate check, soft delete, search across all four searched fields
- Party routes: status codes and error codes for each of the above through Supertest
- Role middleware: header present / absent / unrecognised, and `requireOwner` allow and reject
- Migration: applied against a database seeded with duplicate-cased retailer names, asserting one
  party per distinct normalized name

Frontend testing is not proposed. Adding a component-test harness is its own decision, and the
screens in this slice are thin over the API.

This is the one part of the spec that adds scope beyond the prototype. Accepted on the grounds
above.

## Risks

| Risk | Handling |
|---|---|
| Order Forms unavailable between slices 1 and 2 | Accepted by the user; slice 2 follows immediately |
| Existing order-form data lost | Mitigated: retailer identities become parties, and the old tables are renamed to `legacy_order_*` rather than dropped, so nothing is destroyed and the change is reversible |
| Dirty working tree, many `… 2.js` duplicate files | Untouched by this work; all changes land on a feature branch |
| Role header is trivially spoofed | Explicitly a stand-in. Isolated in one middleware for later replacement |

## Definition of done

- `parties` exists with its unique index; migration back-fills from `order_forms` and renames the
  old tables to `legacy_order_*`
- All five party endpoints behave as tabulated, with the documented error codes
- Party Master lists, searches, creates and edits parties against the real API
- `/stock-out` renders the Overview with a live party count and a working subnav
- `modules/order/`, the old stock-out path, `StockOut.jsx` and `features/orderForms/` are gone,
  and the app builds with no dangling imports
- Vitest runs green via `pnpm test` in `backend/` (if the testing proposal is accepted)
