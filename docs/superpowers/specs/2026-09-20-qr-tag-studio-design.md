# QR Tag Studio — full parity redesign + real QR issuance

Status: approved for planning
Date: 2026-09-20

## 1. Background

`stock-movement/frontend/.../steps/stockIn/QrTagStudioStep.jsx` is step 4 of the Stock In
wizard. It already derives its numbers from real wizard state (Set Matrix totals, QC
results) instead of the fabricated values in the reference mockup
(`qr-tag-studio_3.html`), but it only renders a single sample tag, has no filter/zoom/
issue-flag UI, no action bar, and none of its settings (print strategy, printer, field
toggles, engine/preset) ever reach the backend. The `/stock-in` endpoint only ever issues
QR codes to `SET`/`BUNDLE` stock items; an individual garment only gets its own QR later,
when someone scans a bundle and runs "Break Set" in QR Center. Loose pieces never get a
QR at all today.

This spec covers redesigning the step for full visual/behavioral parity with the mockup
(using only real data — no fabricated fields), and extending the backend so the
"Parent + Child" and "tag loose pieces" strategies can issue real, immediate QR codes to
individual pieces at Stock-In confirm time.

## 2. Decisions (confirmed with user)

1. **Scope of "100% accuracy"**: full visual + behavioral parity (full tag roll with
   per-tag flags, filter chips including Issues, 1×/2× zoom, real A4 pagination, bottom
   action bar with totals + buttons), styled with this app's existing design system, but
   every value/flag must come from real data — no fabricated example content. A field with
   no real data source (e.g. a garment measurement chart) is dropped, same as today.
2. **Backend QR scope**: extend real QR issuance to individual `PIECE` stock items and to
   individually-tagged loose pieces at Stock-In confirm time (not just `SET`/`BUNDLE`).
3. **Parent + Child semantics**: when a bundle's children are tagged at Stock-In, the
   parent's QR is **not** retired. Both the parent (bundle) QR and every child piece QR
   stay `ACTIVE` and independently scannable. This is an explicit, accepted trade-off: the
   same physical pieces could, in principle, be scanned/sold both as "the bundle" and as
   an individual piece. **Building new stock-out guard rails against that double-sell case
   is explicitly out of scope for this work.**
4. **Loose-piece tagging model**: a loose piece that gets tagged is created directly as a
   `PIECE`-type stock item (`originSetStockItemId: null`) rather than a `LOOSE_PIECE`. This
   is the `"LOOSE_RECEIVED"` origin path `qrCenter.service.js`'s resolver already has a
   defined state for (`_resolvePieceState`) but that nothing produces today. Untagged loose
   quantity is unaffected — still `LOOSE_PIECE`, still no QR.
5. **Semi-sets**: not a distinct backend concept (confirmed — a semi-set is a `BUNDLE`
   stock item like any other, distinguished only by which sizes are in its composition).
   The Tag Studio treats any `BUNDLE` whose composition has fewer sizes than the variant's
   full set as a "semi set" parent tag, purely for display/copy purposes.
6. **`breakSet` composition bug**: today, breaking a `BUNDLE` fans out to *all* of the
   variant's full-set sizes, not the bundle's own composition. Since the new Stock-In-time
   child-tagging path needs a composition-aware "create pieces for this item" helper
   anyway, that helper will be shared with `breakSet`, fixing this bug as a byproduct.
7. **`print_jobs.jobType`**: reuse the existing `"QR_GENERATE"` enum value for the job
   created when "Send to printer" is chosen at Stock-In confirm, rather than adding a new
   enum value (avoids a Postgres `ALTER TYPE ... ADD VALUE` migration).
8. **Action-bar button wiring** preserves the existing "nothing persists until the
   Summary step's Confirm Inward" rule:
   - **Save as preset** — real, immediate API call (per-design settings, not stock data;
     safe to persist independent of the stock-in transaction).
   - **Download PDF** — client-side only (browser print dialog on a print-formatted view),
     no new dependency.
   - **Skip · send to QR Center** — advances to Summary with `printOnConfirm=false`. Tags
     are still generated at Confirm per the chosen strategy; they're just not queued to a
     printer immediately — printable later from QR Center, same as today's default.
   - **Send to printer →** — advances to Summary with `printOnConfirm=true`. Actual QR
     issuance and the print job are created only when Summary's Confirm Inward succeeds.

## 3. Frontend changes

All within `frontend/src/features/inventory/{steps,components,hooks,utils}`.

### 3.1 Data layer (`utils/qrTagStudio.js`)
- Add a function to expand the aggregate per-variant rows into **one entry per physical
  tag** (parent/semi/child/loose), each carrying: kind, code (predicted human-readable id
  — real shortCodes don't exist until Confirm), variant, size (if applicable), price,
  composition (if parent/semi), and a `flags[]` array computed from real conditions only:
  - QR module size < 12mm → `bad`; < 15mm → `warn` (existing scan-risk thresholds).
  - Selected field count > `fieldCapacity(...)` for the active label dims → `bad`.
  - No other flags are invented (drops the mockup's fabricated "missing size chart" /
    "missing loose-since date" examples — this app has no real data source for those).
- Add a semi-set detector: a `BUNDLE` row whose composition size-count < variant's full
  set size-count is labeled "SEMI SET" in tag copy instead of "SET".
- Keep `computeVariantRow`/`aggregateRows`/`strategyPreview`/`fieldCapacity`/`labelDims` as
  is; the new expansion function is additive.

### 3.2 New/changed components (`components/stock-in/qrTagStudio/`)
- `LabelPreview.jsx` — extend to render from the full expanded tag list, not one sample.
- `TagRoll.jsx` (new) — the scrollable "every tag in print order" thermal view, one
  `LabelPreview` + flag badges per tag, matching the mockup's `.roll`/`.tagslot`/`.perf`
  structure.
- `A4SheetPreview.jsx` (new) — real paginated grid: computes sheet count from
  `(tags.length + startAt-1) / (cols*rows)`, renders "used" (skipped) cells and per-cell
  tag content for real tags, with page controls.
- `PreviewFilterBar.jsx` (new) — All/Parent/Child/Loose/Issues chips with live counts +
  1×/2× zoom toggle.
- `ActionBar.jsx` (new) — sticky bar: Tags queued / Media / Est. apply time / Need
  attention, and the four action buttons.
- `StrategyCards.jsx`, `GenerationQueue.jsx`, `TagContentConfig.jsx`, `QrPayloadPanel.jsx`,
  `PrintEngineConfig.jsx` — kept, minor styling/copy adjustments only where needed for
  parity (e.g., semi-set-aware copy in `GenerationQueue`).

### 3.3 `QrTagStudioStep.jsx`
- Wire the new preview stack (filter bar → roll or A4 preview → action bar) in place of
  the current single-sample preview.
- `Send to printer` / `Skip` set a new `printOnConfirm` flag (lifted to `StockIn.jsx`) and
  call the wizard's existing `next()`.
- `Save as preset` calls a new `useTagPresetApi` hook (`PUT /stock/tag-presets/:designId`).
- `Download PDF` renders the current filtered/zoomed tag set into a hidden print-only DOM
  node and calls `window.print()`.

### 3.4 `StockIn.jsx` / `buildStockInPayload.js`
- Add `printOnConfirm` state (default `false`), passed to `QrTagStudioStep` and included
  in the payload built for `registerStockIn`.
- Payload gains, per variant: `tagging: { strategy, childTagsEnabled, tagLoosePieces }`
  (derived from `printStrategy` + `qrPerVariantSettings`, same mapping
  `computeVariantRow` already uses to decide `childActive`), and top-level
  `printOnConfirm`, `printerId`.
- `handleConfirmInward`'s success toast reflects whether a print job was actually queued.

## 4. Backend changes

All within `backend/src/modules/stock`, plus one migration.

### 4.1 Migration `0005_tag_preset_config.sql`
```sql
ALTER TABLE tag_presets ADD COLUMN config jsonb;
```
(No enum changes — see decision 7.)

### 4.2 `stockIn.validator.js`
Extend `stockInSchema`, per variant:
```js
tagging: z.object({
  strategy: z.enum(["parent", "parentChild", "custom"]).default("parent"),
  childTagsEnabled: z.boolean().default(false), // only meaningful when strategy="custom"
  tagLoosePieces: z.boolean().default(false),
}).default({ strategy: "parent", childTagsEnabled: false, tagLoosePieces: false }),
```
Top-level, alongside `designs`:
```js
printOnConfirm: z.boolean().default(false),
printerId: z.number().int().positive().optional(), // required if printOnConfirm=true
```

### 4.3 Shared composition-aware piece-creation helper
New method on (or near) `stockItemRepository`/a small new module, e.g.
`stockItem.pieceExpansion.js`:
```js
// Given a source stock item's composition (array of {designSizeId} — one entry per
// physical piece it contains) and its colorVariantId, creates one PIECE stock_item per
// entry, sharing the variant's single PIECE stock_group, and returns the created rows.
async function createPiecesForComposition(tx, { colorVariantId, sizeIds, originSetStockItemId, stockInTransactionId })
```
- `qrCenter.service.js#breakSet` is changed to call this with the **source item's actual
  composition** (looked up via `stock_in_bundle_pieces` for `BUNDLE`s, or the variant's
  full set sizes for `SET`s) instead of always using the variant's full set sizes — fixing
  the fan-out bug described in decision 6.
- The new Stock-In-time path (below) calls the same helper.

### 4.4 `stockInPersistence.service.js` / `stockIn.service.js`
For each variant, after existing SET/BUNDLE/LOOSE_PIECE creation (unchanged):
- If `tagging.strategy === "parentChild"` (or `"custom"` with `childTagsEnabled`): for
  every created SET item, call the helper with the variant's full-set sizes; for every
  created BUNDLE item, call it with that bundle's own composition (from the
  `stock_in_bundle_pieces` rows just created). `originSetStockItemId` is set to the
  parent's id (mirrors `breakSet`, but the parent's QR is **not** retired — decision 3).
- If `tagging.tagLoosePieces`: instead of creating `LOOSE_PIECE` rows for the tagged
  quantity, create that many `PIECE` rows directly via the helper with
  `originSetStockItemId: null` (one call per size, `sizeIds` repeated `quantity` times).
  Untagged loose quantity keeps the existing `LOOSE_PIECE` path unchanged.
- All newly-created `PIECE` rows are included in the list passed to
  `stockQrService.generateForStockItems`, and `QR_ELIGIBLE_TYPES` in `stockQr.service.js`
  gains `"PIECE"`.

### 4.5 Print job on confirm
In `stockIn.service.js`, after the transaction commits successfully: if
`printOnConfirm`, create one `print_jobs` row
(`jobType:"QR_GENERATE", status:"COMPLETED", printerId, totalCount, createdBy:null`) and
`print_job_items` rows (one per `stock_item_qr` row just created across the whole
request), via the existing `printJobRepository.create` /
`printJobItemRepository.createMany`. Response payload includes the created `printJobId`
(or `null`) so the frontend toast can reflect it.

### 4.6 New tag-preset endpoint
- Route: `PUT /stock/tag-presets/:designId` (new file
  `backend/src/modules/stock/routes/tagPreset.route.js`, registered in `routes/index.js`).
- Validator: `presetName` (string), `mediaSize` (string), `defaultPrinterId` (optional
  int), `config` (arbitrary JSON — the field-toggle/typography/qrmm/engine state).
- `tagPreset.repository.js` gains `upsertByDesignId(tx, designId, data)` (insert or update
  on the existing `unique(designId)` constraint).
- New `tagPreset.service.js` + `tagPreset.controller.js` following this codebase's
  existing controller/service/repository layering (see `design` module for the pattern).

## 5. Testing / verification

- Backend: unit-level coverage for `createPiecesForComposition` (correct size expansion
  for SET vs BUNDLE vs semi-set BUNDLE), for the extended `QR_ELIGIBLE_TYPES`, and for the
  fixed `breakSet` composition fan-out. Manual `curl` against `/stock-in` with
  `tagging.strategy="parentChild"` and `tagLoosePieces=true`, confirming DB rows
  (`stock_items.type='PIECE'`, `stock_item_qr` rows, `print_jobs`/`print_job_items` when
  `printOnConfirm=true`).
- Frontend: manual run-through of the Stock In wizard in the browser (per this session's
  `run`-skill convention) covering: all three strategies, all three tabs' field toggles
  hitting/not-hitting capacity flags, thermal and A4 engines, zoom, all four filter chips
  including one that produces at least one flagged tag, Save as preset, Download PDF, both
  Skip and Send-to-printer paths through to a successful Confirm Inward.

## 6. Out of scope

- Stock-out guard rails preventing a bundle and its already-tagged children from both
  being sold (decision 3).
- Any change to `LOOSE_PIECE`'s fungible-pool semantics for the *untagged* portion of
  loose stock.
- Physical printer/driver integration (unchanged — still a UI/DB-level simulation, per the
  existing `handleTestPrint` comment in `StockIn.jsx`).
