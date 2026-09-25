# QR Center Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erase the current QR Center page (health tiles, 5 queue tabs, bulk generators, library accordion) and rebuild it from scratch to visually and behaviorally match the reference file `QR Center — Stock Mgmt (1).html`, wired to the real backend — no mock/demo data in the shipped code.

**Architecture:** Keep the existing route (`/qr-center`), existing DB schema, and existing endpoints wherever they already return the right shape. Add a small number of new backend query methods (no new tables, no schema migrations) where the reference UI needs data that genuinely isn't exposed today (multi-result tag search with filters, printed-vs-total counts on stock-in history, inward/print-history fields on tag detail, a per-batch tag-generation queue). Rebuild the frontend as a new component tree under `frontend/src/features/inventory/components/qrCenter2/` with its own scoped CSS token file modeled on the reference's `:root` variables, then swap `QrCenter.jsx` over to it and delete the old tree.

**Tech Stack:** React 18 + Vite, React Router, TanStack Query (existing hook pattern: `useXyzApi.js` wrapping `useQuery`/`useMutation`), Tailwind v4 (CSS-first, no config file) for the app shell, a scoped plain-CSS token file for the QR Center's own look (matches the existing isolation pattern already used by `qrCenter.theme.css`), Express + Zod validators + Drizzle ORM on the backend, Postgres.

---

## Ground rules carried through every task

1. **No new tables/columns.** Every backend task below is a new repository method / service method / route on top of the existing schema, or a widened Zod schema on an existing route. If a task turns out to need a schema change, stop and flag it instead of adding one.
2. **No demo data.** Nothing named `TAGS`, `HIST`, `DESIGN`, `VAR`, or literal values like `SET-KP100-MID-020` / `JWO-8942` may appear in the final `frontend/src/features/inventory/components/qrCenter2/**` or `frontend/src/features/inventory/pages/QrCenter.jsx`. Task 12 greps for this explicitly.
3. **Reuse existing endpoints first.** Tasks 1-5 (backend) only add what section "Key gaps" in the research below actually proved missing. Everything else (reprint create/bulk-print, break-set, printer list, reason codes) reuses the existing `qrCenter.api.js` functions verbatim.
4. **Old tree is deleted, not left dead.** Task 11 removes `resolver/`, `health/`, `queues/`, `bulk/`, `library/`, `modals/` (the print-guard modals move, see Task 8) under `components/qrCenter/` and their now-unused hooks.
5. **Manual verification, no test framework present.** No Jest/Vitest config was found for this frontend in the research pass. Every frontend task's verification step is "run the dev server, do X in the browser, confirm Y" rather than an automated test. Backend tasks that touch query logic get a verification step using `curl` against the running API server plus a spot-check read of the SQL Drizzle generates (via `console.log` or the query's `.toSQL()` if available) — remove any debug `console.log` before moving on.

---

## File Structure

**Backend — modified only (no new files):**
- `backend/src/modules/stock/repositories/stockItemQr.repository.js` — add `searchActive`, `countActive`.
- `backend/src/modules/stock/repositories/stockInTransaction.repository.js` — widen `findRegistrationsWithQr`/`countRegistrationsWithQr` with filters + add printed-count join.
- `backend/src/modules/stock/repositories/printJobItem.repository.js` — add `findPrintStatsByStockItemIds`.
- `backend/src/modules/stock/repositories/stockInBundlePiece.repository.js` — add `findCompositionByStockInTransactionId` (if no equivalent exists — verified in Task 4).
- `backend/src/modules/stock/repositories/rack.repository.js` — no changes needed (`findAll` already exists).
- `backend/src/modules/stock/services/qrCenter.service.js` — add `searchTags`, extend `listRegistrations`, extend `_resolveSetState`/`_resolvePieceState`, add `getBatchQueue`, extend `getReference` to include racks.
- `backend/src/modules/stock/validators/qrCenter.validator.js` — add `searchTagsQuerySchema`, widen `listQrCenterQuerySchema`, add `batchQueueParamsSchema` (alias of existing param schema).
- `backend/src/modules/stock/routes/qrCenter.route.js` — add `GET /tags`, add `GET /:stockInTransactionId/queue` (registered before the existing catch-all `GET /:stockInTransactionId`).

**Frontend — new files:**
- `frontend/src/features/inventory/qrCenter2.theme.css` — scoped design tokens ported from the reference `:root`.
- `frontend/src/features/inventory/services/qrCenterSearch.api.js` — `searchQrCenterTagsApi`, `getQrCenterBatchQueueApi`.
- `frontend/src/features/inventory/hooks/useQrCenterSearchApi.js`, `useQrCenterBatchQueueApi.js`.
- `frontend/src/features/inventory/components/qrCenter2/QrCenterHeader.jsx`
- `frontend/src/features/inventory/components/qrCenter2/search/SearchBar.jsx`
- `frontend/src/features/inventory/components/qrCenter2/search/FilterBar.jsx`
- `frontend/src/features/inventory/components/qrCenter2/search/ResultList.jsx`
- `frontend/src/features/inventory/components/qrCenter2/search/TagDetail.jsx`
- `frontend/src/features/inventory/components/qrCenter2/history/HistorySection.jsx`
- `frontend/src/features/inventory/components/qrCenter2/history/HistoryFilterBar.jsx`
- `frontend/src/features/inventory/components/qrCenter2/history/HistoryRow.jsx`
- `frontend/src/features/inventory/components/qrCenter2/drawer/Drawer.jsx` (generic slide-in shell)
- `frontend/src/features/inventory/components/qrCenter2/drawer/ReprintDrawer.jsx`
- `frontend/src/features/inventory/components/qrCenter2/drawer/ConfigureBatchDrawer.jsx`
- `frontend/src/features/inventory/components/qrCenter2/shared/TagPreviewLabel.jsx`
- `frontend/src/features/inventory/components/qrCenter2/shared/pills.jsx` (Pill, KindBadge)

**Frontend — modified:**
- `frontend/src/features/inventory/pages/QrCenter.jsx` — replaced entirely.

**Frontend — deleted (Task 11):**
- `frontend/src/features/inventory/components/qrCenter/` entire tree except `ui/qrcUi.jsx` primitives that Task 6 explicitly ports into `qrCenter2/shared/`.
- `frontend/src/features/inventory/qrCenter.theme.css`
- `frontend/src/features/inventory/hooks/useQrCenterHealthApi.js`, `useQrCenterToTagApi.js`, `useQrCenterStaleApi.js`, `useQrCenterRecoveryApi.js`, `useQrCenterJobsApi.js`, `useBulkGenerateApi.js`, `usePrintCheckApi.js`, `useQrCenterPrintGuards.js` (superseded — print-check guard logic is folded directly into `ReprintDrawer.jsx`, see Task 9).

---

## PHASE A — Backend

### Task 1: Tag search endpoint (`GET /qr-center/tags`)

Backs the reference's main search box + filters + multi-result list. Today only `resolve()` (exact single code) and `findQrEligible` (design/variant keyword only, no type/date filter, returns un-QR'd items) exist — neither can return "every ACTIVE tag matching design X, type PIECE, within 30 days."

**Files:**
- Modify: `backend/src/modules/stock/repositories/stockItemQr.repository.js`
- Modify: `backend/src/modules/stock/services/qrCenter.service.js`
- Modify: `backend/src/modules/stock/validators/qrCenter.validator.js`
- Modify: `backend/src/modules/stock/routes/qrCenter.route.js`
- Modify: `backend/src/modules/stock/controllers/qrCenter.controller.js`

- [ ] **Step 1: Add `searchActive` + `countActive` to `stockItemQr.repository.js`**

Add after `findByStockInTransactionId` (the last method in the file, per research ~line 182):

```js
  async searchActive(tx, { keyword, designId, colorVariantId, type, days, limit, offset }) {
    const conditions = [eq(stockItemQr.status, "ACTIVE")];
    if (keyword) {
      conditions.push(
        or(
          ilike(stockItemQr.shortCode, `%${keyword}%`),
          ilike(design.code, `%${keyword}%`),
          ilike(colorVariant.colorName, `%${keyword}%`),
          ilike(stockInTransactions.challanNo, `%${keyword}%`)
        )
      );
    }
    if (designId) conditions.push(eq(design.id, designId));
    if (colorVariantId) conditions.push(eq(colorVariant.id, colorVariantId));
    if (type) conditions.push(eq(stockItems.type, type));
    if (days) conditions.push(gte(stockItemQr.generatedAt, sql`now() - interval '${sql.raw(String(days))} days'`));

    return tx
      .select({
        id: stockItemQr.id,
        stockItemId: stockItemQr.stockItemId,
        shortCode: stockItemQr.shortCode,
        payload: stockItemQr.payload,
        generatedAt: stockItemQr.generatedAt,
        type: stockItems.type,
        rackId: stockItems.rackId,
        rackCode: rack.code,
        binId: stockItems.binId,
        binCode: bin.code,
        designId: design.id,
        designCode: design.code,
        designName: design.name,
        colorVariantId: colorVariant.id,
        colorName: colorVariant.colorName,
        colorHex: colorVariant.colorHex,
        sizeLabel: designSize.sizeLabel,
        challanNo: stockInTransactions.challanNo,
        stockDate: stockInTransactions.stockDate,
      })
      .from(stockItemQr)
      .innerJoin(stockItems, eq(stockItems.id, stockItemQr.stockItemId))
      .innerJoin(colorVariant, eq(colorVariant.id, stockItems.colorVariantId))
      .innerJoin(design, eq(design.id, colorVariant.designId))
      .leftJoin(designSize, eq(designSize.id, stockItems.designSizeId))
      .leftJoin(rack, eq(rack.id, stockItems.rackId))
      .leftJoin(bin, eq(bin.id, stockItems.binId))
      .leftJoin(stockInTransactions, eq(stockInTransactions.id, stockItems.stockInTransactionId))
      .where(and(...conditions))
      .orderBy(desc(stockItemQr.generatedAt))
      .limit(limit)
      .offset(offset);
  }

  async countActive(tx, { keyword, designId, colorVariantId, type, days }) {
    const rows = await this.searchActive(tx, { keyword, designId, colorVariantId, type, days, limit: 100000, offset: 0 });
    return rows.length;
  }
```

Check the top of the file for which of `or`, `ilike`, `gte`, `sql`, `and`, `desc`, `eq` are already imported from `drizzle-orm`, and which table symbols (`stockItems`, `colorVariant`, `design`, `designSize`, `rack`, `bin`, `stockInTransactions`) are already imported — add whichever are missing to the top import block, matching the import style already used in that file (check `findWithContextById` in `stockItem.repository.js` for the exact import names of `colorVariant`, `design`, `designSize`, `rack`, `bin` — reuse those same imports/aliases here for consistency).

`countActive` is a naive count via full-row fetch capped at 100000 — acceptable given this table is bounded by physical inventory (thousands, not millions, of rows). If it's ever slow in practice, replace with `count(*)` in a follow-up; not blocking for this plan.

- [ ] **Step 2: Add `searchTags` to `qrCenter.service.js`**

Add near `resolve()` (after the `resolve` method, ~line 583):

```js
  async searchTags({ keyword, designId, colorVariantId, type, days, page, limit }) {
    const offset = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this._stockItemQrRepository.searchActive(db, { keyword, designId, colorVariantId, type, days, limit, offset }),
      this._stockItemQrRepository.countActive(db, { keyword, designId, colorVariantId, type, days }),
    ]);

    return {
      data: rows.map((row) => ({
        shortCode: row.shortCode,
        stockItemId: row.stockItemId,
        type: row.type,
        design: { id: row.designId, code: row.designCode, name: row.designName },
        variant: { id: row.colorVariantId, colorName: row.colorName, colorHex: row.colorHex },
        sizeLabel: row.sizeLabel,
        rack: row.rackId ? { id: row.rackId, code: row.rackCode } : null,
        bin: row.binId ? { id: row.binId, code: row.binCode } : null,
        challanNo: row.challanNo,
        stockDate: row.stockDate,
        generatedAt: row.generatedAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
```

- [ ] **Step 3: Add validator**

In `qrCenter.validator.js`, add after `resolveQuerySchema`:

```js
export const searchTagsQuerySchema = z.object({
  keyword: z.string().trim().min(1).optional(),
  designId: z.coerce.number().int().positive().optional(),
  colorVariantId: z.coerce.number().int().positive().optional(),
  type: z.enum(["SET", "BUNDLE", "PIECE", "LOOSE_PIECE"]).optional(),
  days: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(30),
});
```

Confirm the exact `stock_group_type` enum values against `backend/src/modules/stock/schemas/stockGroup.schema.js` before finalizing this list (research flagged the type enum lives there, values referenced as SET/BUNDLE/PIECE/LOOSE_PIECE but weren't quoted verbatim — read that file's enum definition and correct this line if the literal values differ).

- [ ] **Step 4: Add route + controller method**

In `qrCenter.route.js`, add before the catch-all `GET /:stockInTransactionId` line (must be earlier in file since Express matches routes top-down and `/tags` would otherwise be swallowed by the `:stockInTransactionId` param):

```js
router.get('/tags', validate({ query: searchTagsQuerySchema }), controller.searchTags);
```

In `qrCenter.controller.js`, add a method following the existing thin pass-through pattern (look at `resolve`'s controller method for the exact `ApiResponse` wrapping style and copy it):

```js
  searchTags = async (req, res) => {
    const result = await qrCenterService.searchTags(req.query);
    return ApiResponse.success(res, result);
  };
```

- [ ] **Step 5: Verify**

Start the backend (`cd backend && npm run dev` or whatever the existing dev script is — check `backend/package.json`), then:

```bash
curl "http://localhost:<port>/qr-center/tags?limit=5"
```

Expected: `200` with `{ "data": [...], "meta": {...} }`, and each row has `shortCode`, `design.code`, `variant.colorName`, `type`. Try `?keyword=<a real design code from your dev DB>` and confirm it narrows results. Try `?type=PIECE` and confirm every row's `type` is `"PIECE"`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/stock/repositories/stockItemQr.repository.js backend/src/modules/stock/services/qrCenter.service.js backend/src/modules/stock/validators/qrCenter.validator.js backend/src/modules/stock/routes/qrCenter.route.js backend/src/modules/stock/controllers/qrCenter.controller.js
git commit -m "feat(qr-center): add multi-result tag search endpoint"
```

---

### Task 2: Stock-in history filters + printed-status counts

Backs the reference's "Stock-in history" table, its status tabs (All / Not printed / Partially printed / Fully printed), and its filters (design/variant/date/sort). Today `listRegistrations` only takes `page`/`limit`/`keyword`, and has no printed-vs-total concept at all (only QR-generated vs eligible).

**Files:**
- Modify: `backend/src/modules/stock/repositories/stockInTransaction.repository.js`
- Modify: `backend/src/modules/stock/repositories/printJobItem.repository.js`
- Modify: `backend/src/modules/stock/services/qrCenter.service.js`
- Modify: `backend/src/modules/stock/validators/qrCenter.validator.js`

- [ ] **Step 1: Add `findPrintStatsByStockItemIds` to `printJobItem.repository.js`**

Add after `findRecentByQrIds`:

```js
  async findPrintStatsByStockItemIds(runner, stockItemIds) {
    if (stockItemIds.length === 0) return [];
    return runner
      .select({
        stockItemId: stockItemQr.stockItemId,
        printedCount: sql`count(distinct ${printJobItem.id})`.mapWith(Number),
      })
      .from(stockItemQr)
      .innerJoin(printJobItem, eq(printJobItem.stockItemQrId, stockItemQr.id))
      .where(inArray(stockItemQr.stockItemId, stockItemIds))
      .groupBy(stockItemQr.stockItemId);
  }
```

Check the top of the file for existing imports of `stockItemQr`, `inArray`, `sql` — add if missing, matching the style of `findRecentByQrIds`'s existing joins.

- [ ] **Step 2: Widen `findRegistrationsWithQr`/`countRegistrationsWithQr` in `stockInTransaction.repository.js`**

Read the current implementation first (research only quoted `registrationSearchCondition`, lines 15-19 — read the full `findRegistrationsWithQr`/`countRegistrationsWithQr` bodies before editing). Add optional params `designId`, `colorVariantId`, `dateFrom`, `dateTo` alongside the existing `keyword`, each appended as an additional `and(...)` condition only when present — follow the exact same "push condition only if param is truthy" pattern already used for `keyword` in that file. Do not change the existing behavior when these new params are omitted (all existing callers pass none of them, so the method must behave identically for them).

- [ ] **Step 3: Extend `listRegistrations` in `qrCenter.service.js` with filters, sort, and printed counts**

Replace the current `listRegistrations` (qrCenter.service.js:208-228) with:

```js
  async listRegistrations({ page, limit, keyword, designId, colorVariantId, dateFrom, dateTo, sort }) {
    const [stockInRows, transformationRows, stockInTotal, transformationTotal] = await Promise.all([
      this._stockInTransactionRepository.findRegistrationsWithQr(db, { limit: REGISTRATION_SAFETY_CAP, offset: 0, keyword, designId, colorVariantId, dateFrom, dateTo }),
      this._stockHistoryRepository.findAssemblyRegistrations(db, { limit: REGISTRATION_SAFETY_CAP, keyword }),
      this._stockInTransactionRepository.countRegistrationsWithQr(db, { keyword, designId, colorVariantId, dateFrom, dateTo }),
      this._stockHistoryRepository.countAssemblyRegistrations(db, { keyword }),
    ]);

    let merged = [
      ...stockInRows.map(toStockInRegistrationView),
      ...transformationRows.map(toTransformationRegistrationView),
    ];

    const allStockItemIds = [];
    // toStockInRegistrationView doesn't carry individual stockItemIds today — see Step 4.

    merged = await this._attachPrintStatus(merged);

    merged.sort((a, b) => sort === "old"
      ? new Date(a.createdAt) - new Date(b.createdAt)
      : new Date(b.createdAt) - new Date(a.createdAt));

    const total = stockInTotal + transformationTotal;
    const offset = (page - 1) * limit;

    return {
      data: merged.slice(offset, offset + limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
```

- [ ] **Step 4: Give `toStockInRegistrationView` the raw stock-item ids it needs, and add `_attachPrintStatus`**

`findRegistrationsWithQr` must select the array of `stockItemId`s belonging to each registration's QR rows so print status can be computed (it likely already joins `stock_item_qr` to get `qrGeneratedCount` — check whether it can add `array_agg(stock_item_qr.stock_item_id)` to the same grouped query, or do a second query). Two viable approaches — pick whichever fits the existing query shape you find in Step 2's read:

- **A (single query):** add `stockItemIds: sql\`array_agg(distinct ${stockItemQr.stockItemId})\`` to the existing `groupBy` query in `findRegistrationsWithQr`, then carry it through `toStockInRegistrationView` as `row.stockItemId` → `registration.stockItemIds`.
- **B (two-pass, simpler if A doesn't fit the existing grouping):** after merging, do one more query per page of results using `stockItemRepository.findByStockInTransactionId` for each `registrationId` in the current page only (not all `REGISTRATION_SAFETY_CAP` rows — only the up-to-`limit` rows about to be returned, to keep this cheap).

Given the codebase's existing `REGISTRATION_SAFETY_CAP` pattern (compute everything, paginate in memory), approach B is safer to implement without risking the existing grouped-count query, and only costs N extra small queries where N = page size (≤100). Implement B:

```js
  async _attachPrintStatus(registrations) {
    return Promise.all(registrations.map(async (r) => {
      if (r.registrationType !== "STOCK_IN") return { ...r, printedCount: r.qrCount, totalCount: r.qrCount, printStatus: "done" };
      const items = await this._stockItemRepository.findByStockInTransactionId(db, r.registrationId);
      const stockItemIds = items.map((i) => i.id);
      const stats = await this._printJobItemRepository.findPrintStatsByStockItemIds(db, stockItemIds);
      const printedCount = stats.reduce((sum, s) => sum + s.printedCount, 0);
      const totalCount = r.qrCount;
      const printStatus = totalCount === 0 ? "pending" : printedCount === 0 ? "pending" : printedCount >= totalCount ? "done" : "partial";
      return { ...r, printedCount, totalCount, printStatus };
    }));
  }
```

This runs after pagination-safety-cap fetch but before the final slice, so it computes stats for up to `REGISTRATION_SAFETY_CAP` rows — same cost profile the existing code already accepts for the merge+sort step. If `REGISTRATION_SAFETY_CAP`'s value (check its definition near the top of the file) is large (e.g. 500+), narrow this to only run `_attachPrintStatus` on `merged.slice(offset, offset + limit)` **after** sorting and slicing instead — move the `_attachPrintStatus` call to wrap only the final `.slice()` result, not the full `merged` array, to avoid N+1 queries against every registration in the system on every request. Prefer this ordering:

```js
    merged.sort(...);
    const page_ = merged.slice(offset, offset + limit);
    const withStatus = await this._attachPrintStatus(page_);
    return { data: withStatus, meta: {...} };
```

- [ ] **Step 5: Add `sort`, `designId`, `colorVariantId`, `dateFrom`, `dateTo` to `listQrCenterQuerySchema`**

```js
export const listQrCenterQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  keyword: z.string().trim().min(2, "Search keyword must be at least 2 characters").optional(),
  designId: z.coerce.number().int().positive().optional(),
  colorVariantId: z.coerce.number().int().positive().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  sort: z.enum(["new", "old"]).default("new"),
});
```

- [ ] **Step 6: Verify**

```bash
curl "http://localhost:<port>/qr-center?limit=5"
```

Expected: each row in `data[]` now has `printedCount`, `totalCount`, `printStatus` (one of `"pending"|"partial"|"done"`) alongside the existing fields. Cross-check one row manually: pick a `registrationId`, run `getQrCenterRegistrationDetailApi`-equivalent curl (`GET /qr-center/<id>`) to see its `totalQrCount`, and separately eyeball the `print_job_items` table for stock items of that transaction to sanity-check `printedCount` isn't wildly wrong.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/stock/repositories/stockInTransaction.repository.js backend/src/modules/stock/repositories/printJobItem.repository.js backend/src/modules/stock/services/qrCenter.service.js backend/src/modules/stock/validators/qrCenter.validator.js
git commit -m "feat(qr-center): add stock-in history filters and printed-status counts"
```

---

### Task 3: Enrich tag detail (inward batch/date, times printed, last printed)

Backs the reference's "Tag detail view" fields that `resolve()` doesn't return today for SET/PIECE states.

**Files:**
- Modify: `backend/src/modules/stock/services/qrCenter.service.js`

- [ ] **Step 1: Extend `_resolveSetState` and `_resolvePieceState`**

Both already receive `context` from `findWithContextById`, which (per research) already returns `stockInTransactionId`... actually it does **not** — re-check: `findWithContextById`'s returned columns (research section 3) do not include `stockInTransactionId`. Add it: in `stockItem.repository.js`, add `stockInTransactionId: stockItems.stockInTransactionId` to the `findWithContextById` select list (it's a plain column on `stock_items`, trivial addition, no new join required).

Then in `qrCenter.service.js`, inside `_resolveSetState` and `_resolvePieceState`, after building the existing return object, look up inward + print info:

```js
  async _resolveSetState(activeRow, context) {
    // ...existing fields built here (design, variant, pieceCount, sizeLabels, rack, sealedDays, mrp)...
    const inward = context.stockInTransactionId
      ? await this._stockInTransactionRepository.findById(db, context.stockInTransactionId)
      : null;
    const printStats = await this._printJobItemRepository.findRecentByQrIds(db, [activeRow.id], null);
    const timesPrinted = printStats.length;
    const lastPrinted = printStats.length
      ? printStats.reduce((latest, p) => (!latest || p.printedAt > latest.printedAt ? p : latest), null)
      : null;

    return {
      state: "SET",
      set: {
        // ...existing fields...
        inwardBatch: inward?.challanNo ?? null,
        inwardDate: inward?.stockDate ?? null,
        timesPrinted,
        lastPrintedAt: lastPrinted?.printedAt ?? null,
      },
    };
  }
```

Apply the identical pattern to `_resolvePieceState` (same `inward`/`printStats` lookups, same two new fields added to the returned `piece` object). Confirm `stockInTransactionRepository` has a plain `findById` (research listed repo methods without confirming this one exists on this specific repo — if missing, add a two-line `findById(tx, id) { const [row] = await tx.select().from(stockInTransactions).where(eq(stockInTransactions.id, id)).limit(1); return row; }` following the exact pattern already used in `printer.repository.js`'s `findById`).

- [ ] **Step 2: Verify**

```bash
curl "http://localhost:<port>/qr-center/resolve?code=<a real SET short code from your dev DB>"
```

Expected: `data.set.inwardBatch`, `data.set.inwardDate`, `data.set.timesPrinted`, `data.set.lastPrintedAt` all present (batch/date may be `null` if that stock item predates `stockInTransactionId` being populated — that's fine, means the UI should render "—" for legacy rows). Repeat with a PIECE short code.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/stock/services/qrCenter.service.js backend/src/modules/stock/repositories/stockItem.repository.js backend/src/modules/stock/repositories/stockInTransaction.repository.js
git commit -m "feat(qr-center): add inward batch/date and print history to tag detail"
```

---

### Task 4: Batch "Configure & print" generation queue

Backs the reference's "Configure & print" drawer (tagging strategy radio, generation queue table, tag content tabs, verify list) for a stock-in batch whose tags weren't all generated.

**Files:**
- Modify: `backend/src/modules/stock/repositories/stockInBundlePiece.repository.js` (only if the needed query doesn't already exist — check first)
- Modify: `backend/src/modules/stock/services/qrCenter.service.js`
- Modify: `backend/src/modules/stock/validators/qrCenter.validator.js`
- Modify: `backend/src/modules/stock/routes/qrCenter.route.js`
- Modify: `backend/src/modules/stock/controllers/qrCenter.controller.js`

- [ ] **Step 1: Read `stockPieceExpansion.service.js` in full before writing anything**

This service (69 lines, referenced but not deep-read in research) is very likely where the Stock-In wizard already computes "how many SET/semi/child/loose tags does this batch need" during registration. If it exports a function that takes a `stockInTransactionId` (or the raw bundle/loose-piece rows) and returns per-variant set/semi/loose/child counts, **reuse it directly** instead of writing new counting logic — this is exactly the kind of duplicate-endpoint the ground rules forbid. Read it now and note its exact exported function name(s) and signature before Step 2.

- [ ] **Step 2: Add `getBatchQueue(stockInTransactionId)` to `qrCenter.service.js`**

```js
  async getBatchQueue(stockInTransactionId) {
    const registration = await this._stockInTransactionRepository.findByIdWithContext(db, stockInTransactionId);
    if (!registration) {
      throw new ApiError(`Stock registration ${stockInTransactionId} not found.`, 404, "STOCK_REGISTRATION_NOT_FOUND");
    }
    const items = await this._stockItemRepository.findByStockInTransactionId(db, stockInTransactionId);
    const qrRows = await this._stockItemQrRepository.findByStockInTransactionId(db, stockInTransactionId);
    const taggedIds = new Set(qrRows.map((r) => r.stockItemId));
    const untagged = items.filter((i) => !taggedIds.has(i.id));

    const sets = untagged.filter((i) => i.type === "SET" || i.type === "BUNDLE");
    const loose = untagged.filter((i) => i.type === "LOOSE_PIECE");

    return {
      registration: {
        stockInTransactionId: registration.stockInTransactionId,
        challanNo: registration.challanNo,
        stockDate: registration.stockDate,
        design: { id: registration.designId, code: registration.designCode, name: registration.designName },
        variant: { id: registration.colorVariantId, colorName: registration.colorName, colorHex: registration.colorHex },
      },
      untaggedSetCount: sets.length,
      untaggedLooseCount: loose.length,
      untaggedStockItemIds: untagged.map((i) => i.id),
    };
  }
```

Adjust field names to match whatever `findByIdWithContext`/`findByStockInTransactionId` actually return (research didn't quote `findByIdWithContext`'s exact columns — read it before finalizing; it's used by the existing `_getStockInRegistrationDetail`, so its shape is already known to be `{ stockInTransactionId, stockDate, challanNo, designId, designCode, designName, colorVariantId, colorName, colorHex, imageUrl }` per that method's existing usage — reuse the same field names).

If Step 1 found a reusable per-size/semi-set breakdown function in `stockPieceExpansion.service.js`, call it here instead of the flat set/loose count above and include its richer per-variant/per-size shape in the response — match whatever shape the Stock-In wizard's `GenerationQueue.jsx` (frontend) already expects, since Task 9's drawer will reuse that same table-rendering logic pattern.

- [ ] **Step 3: Route + validator + controller**

```js
// validator: reuse getRegistrationDetailParamsSchema (already validates stockInTransactionId) — no new schema needed.
```

```js
// route.js — add BEFORE the catch-all `GET /:stockInTransactionId`:
router.get('/:stockInTransactionId/queue', validate({ params: getRegistrationDetailParamsSchema }), controller.getBatchQueue);
```

```js
// controller.js:
  getBatchQueue = async (req, res) => {
    const result = await qrCenterService.getBatchQueue(req.params.stockInTransactionId);
    return ApiResponse.success(res, result);
  };
```

- [ ] **Step 4: Verify**

Find a `stockInTransactionId` in your dev DB with `qrStatus: "PARTIAL"` from Task 2's history endpoint, then:

```bash
curl "http://localhost:<port>/qr-center/<id>/queue"
```

Expected: `untaggedSetCount`/`untaggedLooseCount` roughly match what you'd manually count as missing for that batch (cross-check against `GET /qr-center/<id>` from `_getStockInRegistrationDetail`'s `totalQrCount` vs the transaction's known `totalSetsReceived`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/stock/services/qrCenter.service.js backend/src/modules/stock/validators/qrCenter.validator.js backend/src/modules/stock/routes/qrCenter.route.js backend/src/modules/stock/controllers/qrCenter.controller.js
git commit -m "feat(qr-center): add batch tag-generation queue endpoint"
```

---

### Task 5: Add racks to `getReference`

Backs the reprint drawer's rack context and any rack filter. Trivial — `rackRepository.findAll` already exists.

**Files:**
- Modify: `backend/src/modules/stock/services/qrCenter.service.js`

- [ ] **Step 1: Widen `getReference`**

```js
  async getReference() {
    const [printers, tagPresets, racks] = await Promise.all([
      this._printerRepository.findAllActive(db),
      this._tagPresetRepository.findAllWithContext(db),
      this._rackRepository.findAll(db),
    ]);

    return {
      printers: printers.map((row) => ({ id: row.id, name: row.name, location: row.location, isActive: row.isActive })),
      reasonCodes: REASON_CODES,
      permissions: PERMISSIONS,
      tagPresets: tagPresets.map((row) => ({ designId: row.designId, designCode: row.designCode, presetName: row.presetName, mediaSize: row.mediaSize, defaultPrinter: row.defaultPrinterName ?? null })),
      racks: racks.map((row) => ({ id: row.id, code: row.code, label: row.label })),
    };
  }
```

Confirm `this._rackRepository` is already injected into the service's constructor (it must be, since `resolve()` uses `this._rackRepository.findByCode` already) — just reuse the existing instance property name.

- [ ] **Step 2: Verify**

```bash
curl "http://localhost:<port>/qr-center/reference"
```

Expected: response now also has `data.racks: [{id, code, label}, ...]`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/stock/services/qrCenter.service.js
git commit -m "feat(qr-center): include racks in reference endpoint"
```

---

## PHASE B — Frontend

### Task 6: Scoped theme + shared primitives

**Files:**
- Create: `frontend/src/features/inventory/qrCenter2.theme.css`
- Create: `frontend/src/features/inventory/components/qrCenter2/shared/pills.jsx`
- Create: `frontend/src/features/inventory/components/qrCenter2/shared/TagPreviewLabel.jsx`
- Create: `frontend/src/features/inventory/components/qrCenter2/drawer/Drawer.jsx`

- [ ] **Step 1: Port the reference's `:root` tokens into a scoped class**

Create `qrCenter2.theme.css`. Copy the reference HTML's `:root{...}` block (colors, fonts, radius, shadow) verbatim, but scope every rule under `.qr-center-scope-2` (a new class name — deliberately different from the old `.qr-center-scope` so there's zero risk of the old and new trees visually bleeding into each other during the transition in Task 10) instead of `:root`, and scope every bare-element rule (`button{}`, `input,select{}`, `.mono{}`, `.btn{}`, `.pill{}`, etc.) under `.qr-center-scope-2` too, exactly like the existing `qrCenter.theme.css` already does for its own tokens (open that file side by side as your scoping reference — same technique, new class name, new token values from the HTML reference). Import Inter/JetBrains Mono the same way the old file does (Google Fonts `@import url(...)`).

Port these reference sections in full: `.searchwrap`/`#q`/`.filters`/`.fsel`, `.rlist`/`.rrow`, `.detail`/`.dhd`/`.dbd`/`.grid`/`.f`, `.children`/`.chd`/`.crow`, `.dact`/`.note`, `.btn`/`.pill`/`.kind`, `.seg`, `.hwrap`/`.hhead`/`.hrow`, `.scrim`/`.drawer`/`.drhead`/`.drbody`/`.drfoot`, `.lockcode`, `.fg`/`.radios`/`.rad`/`.reasons`/`.rbtn`, `.dualprev`/`.prevcol`/`.rollstack`/`.a4wrap`/`.a4grid`/`.a4cell`, `.qt`, `.tabs2`/`.frow`/`.cb`/`.req`, `.tagprev`/`.lbl`/`.lbl-top`/`.lbl-b`/`.lbl-t`/`.lbl-f`/`.bars`, `.vlist`/`.vrow`, `.chk`, `.callout`. Rename every one of these classes with a distinguishing prefix if you're worried about collision with the old tree's similarly-named classes (`.detail`, `.btn`, `.pill` are generic enough to risk collision) — safest is to prefix all of them, e.g. `.qrc2-detail`, `.qrc2-btn`, `.qrc2-pill`, and do the same rename inside every component in Tasks 7-9 consistently. Pick the prefix now and use it everywhere below (`qrc2-` is assumed for the rest of this plan).

- [ ] **Step 2: `shared/pills.jsx`**

```jsx
export function Pill({ tone = "neu", children }) {
  return <span className={`qrc2-pill qrc2-pill-${tone}`}>{children}</span>;
}

export function KindBadge({ kind }) {
  return <span className={`qrc2-kind qrc2-kind-${kind}`}>{kind}</span>;
}
```

`tone` matches the reference's `.pill.ok/.warn/.part/.neu`; `kind` matches `.kind.SET/.SEMI/.PIECE/.LOOSE`.

- [ ] **Step 3: `shared/TagPreviewLabel.jsx`**

Port the reference's `label(id, k, d, v, opt)` JS string-builder (in the HTML's `<script>`, function `label`) into a real React component taking real props instead of the demo `DESIGN`/`VAR` lookup objects:

```jsx
import QrCodeImage from "../../qr-center/QrCodeImage";

export default function TagPreviewLabel({ shortCode, kind, designCode, designName, colorName, sizeLabel, semiLabel, parentShortCode, mrp, inwardDate }) {
  const isSet = kind === "SET";
  const isSemi = kind === "SEMI";
  const isLoose = kind === "LOOSE";
  return (
    <div className="qrc2-lbl">
      <div className="qrc2-lbl-top">
        <span>STOCK MGMT</span>
        <span>[{isSet ? "PARENT SET" : isSemi ? "SEMI SET" : isLoose ? "LOOSE PIECE" : "GARMENT PIECE"}]</span>
      </div>
      <div className="qrc2-lbl-b">
        <div><QrCodeImage value={shortCode} size={58} /></div>
        <div className="qrc2-lbl-t">
          <div className="qrc2-c1">{designCode}</div>
          <div className="qrc2-c2">{designName}</div>
          <div className="qrc2-c3">{colorName?.toUpperCase()}</div>
          {isSet && <div className="qrc2-c4">SET · {mrp != null ? `MRP ₹ ${mrp}` : ""}</div>}
          {isSemi && <div className="qrc2-c4">SEMI: {semiLabel}</div>}
          {!isSet && !isSemi && (
            <>
              <div className="qrc2-c4">SIZE {sizeLabel ?? "—"}</div>
              {parentShortCode && <div className="qrc2-c6">PARENT: {parentShortCode}</div>}
              {isLoose && <div className="qrc2-c6">LOOSE — FROM JOBBER</div>}
            </>
          )}
          {inwardDate && <div className="qrc2-c6">INWARD {inwardDate}</div>}
        </div>
      </div>
      <div className="qrc2-lbl-f"><span className="qrc2-id">{shortCode}</span></div>
    </div>
  );
}
```

Check `frontend/src/features/inventory/components/qr-center/QrCodeImage.jsx`'s actual prop signature (`value`/`size` assumed — confirm against the real file, it's a small existing component) before finalizing this import.

- [ ] **Step 4: `drawer/Drawer.jsx`** — generic slide-in shell, net new (no existing drawer primitive per research)

```jsx
import { useEffect } from "react";

export default function Drawer({ open, onClose, title, subtitle, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`qrc2-scrim${open ? " qrc2-on" : ""}`} onClick={onClose} />
      <aside className={`qrc2-drawer${open ? " qrc2-on" : ""}`} role="dialog" aria-label={title}>
        <div className="qrc2-drhead">
          <div><h3>{title}</h3><div className="qrc2-m">{subtitle}</div></div>
          <button className="qrc2-btn qrc2-sm" onClick={onClose}>Close</button>
        </div>
        <div className="qrc2-drbody">{children}</div>
        <div className="qrc2-drfoot">{footer}</div>
      </aside>
    </>
  );
}
```

Mirrors the reference's `.scrim`/`.drawer`/`.drhead`/`.drbody`/`.drfoot` + open/close/Escape behavior exactly, but as a controlled React component (`open`/`onClose` props) instead of the HTML's imperative `show()`/`hide()`.

- [ ] **Step 5: Verify**

No page wires these up yet — just run `npm run build` (or the frontend's lint/typecheck script, check `frontend/package.json`) to confirm no syntax errors in the four new files before moving on.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/inventory/qrCenter2.theme.css frontend/src/features/inventory/components/qrCenter2/shared frontend/src/features/inventory/components/qrCenter2/drawer/Drawer.jsx
git commit -m "feat(qr-center): add scoped theme and shared primitives for redesign"
```

---

### Task 7: API + hooks for the two new endpoints

**Files:**
- Create: `frontend/src/features/inventory/services/qrCenterSearch.api.js`
- Create: `frontend/src/features/inventory/hooks/useQrCenterSearchApi.js`
- Create: `frontend/src/features/inventory/hooks/useQrCenterBatchQueueApi.js`

- [ ] **Step 1: `qrCenterSearch.api.js`**

```js
const baseURL = import.meta.env.VITE_API_BASE_URL;

async function request(path, params) {
  const search = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, value);
  });
  const qs = search.toString();
  const response = await fetch(`${baseURL}/qr-center${path}${qs ? `?${qs}` : ""}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? data?.message ?? "QR Center request failed.");
  return data;
}

export const searchQrCenterTagsApi = (params) => request("/tags", params);
export const getQrCenterBatchQueueApi = (stockInTransactionId) => request(`/${stockInTransactionId}/queue`);
```

- [ ] **Step 2: `useQrCenterSearchApi.js`**

```js
import { useQuery } from "@tanstack/react-query";
import { searchQrCenterTagsApi } from "../services/qrCenterSearch.api";

export function useQrCenterSearchApi(params, options = {}) {
  return useQuery({
    queryKey: ["qr-center-search", params],
    queryFn: () => searchQrCenterTagsApi(params),
    enabled: options.enabled ?? true,
    staleTime: 10_000,
  });
}
```

Match the exact `@tanstack/react-query` import path and options style already used in `useQrCenterResolveApi.js` — open that file and copy its conventions (this plan assumes `@tanstack/react-query`; confirm the actual package name from that file's import line and correct here if different).

- [ ] **Step 3: `useQrCenterBatchQueueApi.js`**

```js
import { useQuery } from "@tanstack/react-query";
import { getQrCenterBatchQueueApi } from "../services/qrCenterSearch.api";

export function useQrCenterBatchQueueApi(stockInTransactionId, options = {}) {
  return useQuery({
    queryKey: ["qr-center-batch-queue", stockInTransactionId],
    queryFn: () => getQrCenterBatchQueueApi(stockInTransactionId),
    enabled: (options.enabled ?? true) && !!stockInTransactionId,
  });
}
```

- [ ] **Step 4: Verify**

`npm run build` (or lint) passes with no import errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/inventory/services/qrCenterSearch.api.js frontend/src/features/inventory/hooks/useQrCenterSearchApi.js frontend/src/features/inventory/hooks/useQrCenterBatchQueueApi.js
git commit -m "feat(qr-center): add frontend API/hooks for search and batch queue"
```

---

### Task 8: Search section (search bar, filters, result list, tag detail)

**Files:**
- Create: `frontend/src/features/inventory/components/qrCenter2/search/SearchBar.jsx`
- Create: `frontend/src/features/inventory/components/qrCenter2/search/FilterBar.jsx`
- Create: `frontend/src/features/inventory/components/qrCenter2/search/ResultList.jsx`
- Create: `frontend/src/features/inventory/components/qrCenter2/search/TagDetail.jsx`

- [ ] **Step 1: `SearchBar.jsx`**

```jsx
export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="qrc2-searchwrap">
      <svg className="qrc2-mag" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" placeholder={placeholder} />
    </div>
  );
}
```

- [ ] **Step 2: `FilterBar.jsx`** — takes real design/variant/rack options as props (from `getQrCenterReferenceApi` + a designs/variants source — check whether the app already has a `useDesignsApi`/`useColorVariantsApi` hook under `frontend/src/features/design/` to reuse for populating the design/variant dropdowns; if one exists, import and reuse it rather than inventing a new endpoint)

```jsx
const TYPES = [
  { value: "", label: "All tag types" },
  { value: "SET", label: "Parent set" },
  { value: "BUNDLE", label: "Semi set" },
  { value: "PIECE", label: "Child piece" },
  { value: "LOOSE_PIECE", label: "Loose piece" },
];
const DATE_RANGES = [
  { value: "", label: "Any date" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export default function FilterBar({ designs, variants, filters, onChange, onClear, resultCount, showCount }) {
  return (
    <div className="qrc2-filters">
      <span className="qrc2-fsel">
        <select value={filters.designId} onChange={(e) => onChange({ ...filters, designId: e.target.value, colorVariantId: "" })}>
          <option value="">All designs</option>
          {designs.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
        </select>
      </span>
      <span className="qrc2-fsel">
        <select value={filters.colorVariantId} onChange={(e) => onChange({ ...filters, colorVariantId: e.target.value })}>
          <option value="">All variants</option>
          {variants.filter((v) => !filters.designId || String(v.designId) === String(filters.designId)).map((v) => (
            <option key={v.id} value={v.id}>{v.colorName}</option>
          ))}
        </select>
      </span>
      <span className="qrc2-fsel">
        <select value={filters.type} onChange={(e) => onChange({ ...filters, type: e.target.value })}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </span>
      <span className="qrc2-fsel">
        <select value={filters.days} onChange={(e) => onChange({ ...filters, days: e.target.value })}>
          {DATE_RANGES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </span>
      <button className="qrc2-fclear" onClick={onClear}>Clear filters</button>
      {showCount && <span className="qrc2-rcount">{resultCount} {resultCount === 1 ? "match" : "matches"}</span>}
    </div>
  );
}
```

- [ ] **Step 3: `ResultList.jsx`**

```jsx
import { Pill, KindBadge } from "../shared/pills";
import QrCodeImage from "../../qr-center/QrCodeImage";

const KIND_LABEL = { SET: "SET", BUNDLE: "SEMI", PIECE: "PIECE", LOOSE_PIECE: "LOOSE" };

export default function ResultList({ tags, onSelect, loading, hasQuery }) {
  if (loading) return <div className="qrc2-rlist"><div className="qrc2-empty">Searching…</div></div>;
  if (!hasQuery) {
    return (
      <div className="qrc2-rlist">
        <div className="qrc2-empty">
          <b>Search or filter to begin</b>
          Type a set ID, a design code, or a challan number. Scan straight into the box with a handheld reader.
        </div>
      </div>
    );
  }
  if (!tags.length) {
    return (
      <div className="qrc2-rlist">
        <div className="qrc2-empty">
          <b>No tag matches</b>
          Check the code, or widen the filters.
        </div>
      </div>
    );
  }
  return (
    <div className="qrc2-rlist">
      {tags.map((t) => (
        <button key={t.shortCode} className="qrc2-rrow" onClick={() => onSelect(t.shortCode)}>
          <span className="qrc2-mini"><QrCodeImage value={t.shortCode} size={34} /></span>
          <span className="qrc2-info">
            <span className="qrc2-c">{t.shortCode}</span>
            <span className="qrc2-d">
              {t.design.code} · {t.design.name} · {t.variant.colorName}
              {t.sizeLabel ? ` · size ${t.sizeLabel}` : ""}
              {t.rack ? ` · rack ${t.rack.code}` : ""}
            </span>
          </span>
          <KindBadge kind={KIND_LABEL[t.type] ?? t.type} />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: `TagDetail.jsx`** — consumes `resolveQrCenterCodeApi`'s existing response shape (already used by `ResolverSection`), rendered for whichever `state` comes back (`SET`/`PIECE`/`RETIRED`/`DUPLICATE`/`RACK`/`UNKNOWN`), plus the new Task 3 fields for SET/PIECE

```jsx
import TagPreviewLabel from "../shared/TagPreviewLabel";
import { KindBadge } from "../shared/pills";

export default function TagDetail({ result, onBack, onRaiseReprint }) {
  if (!result) return null;
  if (result.state === "SET") {
    const s = result.set;
    return (
      <div className="qrc2-detail">
        <DetailHead code={s.shortCode} kind="SET" onBack={onBack} />
        <div className="qrc2-dbd">
          <TagPreviewLabel shortCode={s.shortCode} kind="SET" designCode={s.design.code} designName={s.design.name} colorName={s.variant.colorName} mrp={s.mrp} inwardDate={s.inwardDate} />
          <div>
            <div className="qrc2-dtitle">{s.design.code} · {s.variant.colorName}</div>
            <div className="qrc2-dmeta">{s.pieceCount}-piece set ({s.sizeLabels?.join(" · ")}){s.rack ? ` · rack ${s.rack.code}` : ""}</div>
            <div className="qrc2-grid">
              <Field k="Set MRP" v={s.mrp != null ? `₹ ${s.mrp}` : "—"} />
              <Field k="Inward batch" v={s.inwardBatch ?? "—"} sm />
              <Field k="Inward date" v={s.inwardDate ?? "—"} sm />
              <Field k="Times printed" v={`${s.timesPrinted ?? 0} ×`} />
              <Field k="Last printed" v={s.lastPrintedAt ?? "—"} sm />
              <Field k="Sealed" v={`${s.sealedDays} d ago`} />
            </div>
          </div>
        </div>
        <div className="qrc2-dact">
          <button className="qrc2-btn qrc2-pri" onClick={() => onRaiseReprint({ stockItemId: s.stockItemId, shortCode: s.shortCode })}>Reprint this tag</button>
        </div>
      </div>
    );
  }
  if (result.state === "PIECE") {
    const p = result.piece;
    return (
      <div className="qrc2-detail">
        <DetailHead code={p.shortCode} kind="PIECE" onBack={onBack} />
        <div className="qrc2-dbd">
          <TagPreviewLabel shortCode={p.shortCode} kind="PIECE" designCode={p.design.code} designName={p.design.name} colorName={p.variant.colorName} sizeLabel={p.sizeLabel} parentShortCode={p.parent?.shortCode} inwardDate={p.inwardDate} />
          <div>
            <div className="qrc2-dtitle">{p.design.code} · {p.variant.colorName}</div>
            <div className="qrc2-dmeta">Child piece · size {p.sizeLabel ?? "—"}{p.bin ? ` · bin ${p.bin.code}` : ""}</div>
            <div className="qrc2-grid">
              <Field k="Inward batch" v={p.inwardBatch ?? "—"} sm />
              <Field k="Inward date" v={p.inwardDate ?? "—"} sm />
              <Field k="Times printed" v={`${p.timesPrinted ?? 0} ×`} />
              <Field k="Last printed" v={p.lastPrintedAt ?? "—"} sm />
              <Field k="Parent set" v={p.parent?.shortCode ?? "—"} sm />
            </div>
          </div>
        </div>
        <div className="qrc2-dact">
          <button className="qrc2-btn qrc2-pri" onClick={() => onRaiseReprint({ stockItemId: p.stockItemId, shortCode: p.shortCode })}>Reprint this tag</button>
        </div>
      </div>
    );
  }
  if (result.state === "RETIRED") {
    const r = result.retired;
    return (
      <div className="qrc2-detail qrc2-gone">
        <DetailHead code={r.shortCode} kind="RETIRED" onBack={onBack} />
        <div className="qrc2-note qrc2-info">
          <b>Retired {r.retiredAt} — {r.retiredReason ?? "no reason recorded"}.</b> Its pieces carry their own tags now.
        </div>
        {r.successors?.length > 0 && (
          <div className="qrc2-children">
            {r.successors.map((s) => (
              <button key={s.shortCode} className="qrc2-crow" onClick={() => onBack(s.shortCode)}>
                <span className="qrc2-cc">{s.shortCode}</span><span className="qrc2-st">{s.sizeLabel}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (result.state === "UNKNOWN") {
    return <div className="qrc2-rlist"><div className="qrc2-empty"><b>Unrecognized code</b>{result.code} doesn't match any tag on file.</div></div>;
  }
  return null; // DUPLICATE / RACK states: reuse ResolverSection's existing ResultDuplicate/ResultRack render logic, ported the same way (omitted here for brevity — implement by porting those two components verbatim from the old ResolverSection.jsx before it's deleted in Task 11, restyled with qrc2- classes).
}

function DetailHead({ code, kind, onBack }) {
  return (
    <div className="qrc2-dhd">
      <span className="qrc2-code">{code} <KindBadge kind={kind} /></span>
      <button className="qrc2-back" onClick={() => onBack(null)}>Back to results</button>
    </div>
  );
}
function Field({ k, v, sm }) {
  return <div className="qrc2-f"><div className="qrc2-k">{k}</div><div className={`qrc2-v${sm ? " qrc2-sm" : ""}`}>{v}</div></div>;
}
```

The DUPLICATE/RACK branch is intentionally left as a follow-up within this same task — before marking this step done, open the old `ResolverSection.jsx`'s `ResultDuplicate`/`ResultRack` sub-components (research section 7 quotes their exact field usage) and port both into this file the same way `SET`/`PIECE`/`RETIRED` were ported above, using `qrc2-` classes. Do not delete `ResolverSection.jsx` (Task 11) until this porting is confirmed done for all six states.

- [ ] **Step 5: Verify**

Not wired to a page yet — `npm run build`/lint passes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/inventory/components/qrCenter2/search
git commit -m "feat(qr-center): add search bar, filters, result list, and tag detail components"
```

---

### Task 9: Reprint drawer + Configure & print drawer

**Files:**
- Create: `frontend/src/features/inventory/components/qrCenter2/drawer/ReprintDrawer.jsx`
- Create: `frontend/src/features/inventory/components/qrCenter2/drawer/ConfigureBatchDrawer.jsx`

- [ ] **Step 1: `ReprintDrawer.jsx`** — reuses the exact create-then-bulk-print sequence already established in `ResolverSection.jsx`'s `useQuickReprint` (research section 8), and the existing `printCheckApi` duplicate-print guard

```jsx
import { useState } from "react";
import Drawer from "./Drawer";
import TagPreviewLabel from "../shared/TagPreviewLabel";
import { createQrCenterReprintApi, bulkPrintReprintsApi, getQrCenterReferenceApi, printCheckApi } from "../../../services/qrCenter.api";
import { useQuery } from "@tanstack/react-query";

const REASONS = ["LOST", "TORN", "FADED", "REBAG", "JAM", "PRICE_CHANGE"];

export default function ReprintDrawer({ open, onClose, targets, onDone }) {
  const [reason, setReason] = useState("REBAG");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { data: referenceResponse } = useQuery({ queryKey: ["qr-center-reference"], queryFn: getQrCenterReferenceApi });
  const printers = referenceResponse?.data?.printers ?? [];
  const defaultPrinter = printers.find((p) => p.isActive) ?? printers[0];

  const n = targets?.length ?? 0;

  const handlePrint = async () => {
    if (!defaultPrinter) return;
    setSubmitting(true);
    try {
      const stockItemQrIds = targets.map((t) => t.stockItemQrId).filter(Boolean);
      if (stockItemQrIds.length) {
        const check = await printCheckApi({ stockItemQrIds });
        if (check?.data?.duplicates?.length && !window.confirm(`${check.data.duplicates.length} of these were printed in the last few minutes. Print again?`)) {
          setSubmitting(false);
          return;
        }
      }
      const reprintRequestIds = [];
      for (const t of targets) {
        const created = await createQrCenterReprintApi({ stockItemId: t.stockItemId, reasonCode: reason, raisedBy: "zelero.tech@gmail.com" });
        reprintRequestIds.push(created?.data?.id);
      }
      await bulkPrintReprintsApi({ reprintRequestIds: reprintRequestIds.filter(Boolean), printerId: defaultPrinter.id });
      onDone?.();
      onClose();
    } finally {
      setSubmitting(false);
      setConfirmed(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Reprint ${n} tag${n === 1 ? "" : "s"}`}
      subtitle="Exact duplicate — nothing here can change what prints"
      footer={
        <>
          <span className="qrc2-left"><b>{n}</b> tag{n === 1 ? "" : "s"}</span>
          <button className="qrc2-btn" onClick={onClose}>Cancel</button>
          <button className="qrc2-btn qrc2-pri" disabled={!confirmed || submitting || !defaultPrinter} onClick={handlePrint}>
            Print {n} replacement{n === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <div className="qrc2-lockcode">
        <div className="qrc2-k">Reprinting — payload locked, codes never change</div>
        <div className="qrc2-v">{n} tag{n === 1 ? "" : "s"} selected</div>
      </div>

      <div className="qrc2-fg">
        <label>Reason — required</label>
        <div className="qrc2-reasons">
          {REASONS.map((r) => (
            <button key={r} className={`qrc2-rbtn${reason === r ? " qrc2-on" : ""}`} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
      </div>

      <div className="qrc2-fg">
        <label>Preview</label>
        <div className="qrc2-rollstack">
          {(targets ?? []).map((t) => (
            <TagPreviewLabel key={t.shortCode} shortCode={t.shortCode} kind={t.kind} designCode={t.designCode} designName={t.designName} colorName={t.colorName} sizeLabel={t.sizeLabel} />
          ))}
        </div>
      </div>

      <label className="qrc2-chk">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span className="qrc2-t"><b>Every old label above has been physically destroyed or removed.</b> Reprinting without destroying the original leaves two labels answering to the same code.</span>
      </label>
    </Drawer>
  );
}
```

Note: `printCheckApi`'s actual response shape for `duplicates` was not confirmed by research (only the request schema `{stockItemQrIds}` was). Before finalizing this step, `curl -X POST http://localhost:<port>/qr-center/print-check -H 'Content-Type: application/json' -d '{"stockItemQrIds":[<a real id>]}'` and adjust the `check?.data?.duplicates` access path to match whatever key the real response actually uses.

- [ ] **Step 2: `ConfigureBatchDrawer.jsx`** — consumes Task 4's `getQrCenterBatchQueueApi` + Task 1's `generateForStockItemIds` (existing `POST /qr-center/generate`, already in `qrCenter.api.js` — confirm the exact export name, research didn't explicitly list a `generateQrApi` wrapper; if missing, add a one-line export to `qrCenter.api.js` following the existing `qrCenterRequest` helper pattern: `export const generateQrApi = (stockItemIds) => qrCenterRequest("/generate", { method: "POST", body: { stockItemIds } });`)

```jsx
import { useState } from "react";
import Drawer from "./Drawer";
import { useQrCenterBatchQueueApi } from "../../../hooks/useQrCenterBatchQueueApi";
import { generateQrApi } from "../../../services/qrCenter.api";

export default function ConfigureBatchDrawer({ open, onClose, stockInTransactionId, onDone }) {
  const { data: response, isLoading } = useQrCenterBatchQueueApi(stockInTransactionId, { enabled: open });
  const [submitting, setSubmitting] = useState(false);
  const queue = response?.data;

  const handlePrint = async () => {
    if (!queue?.untaggedStockItemIds?.length) return;
    setSubmitting(true);
    try {
      await generateQrApi(queue.untaggedStockItemIds);
      onDone?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Configure & print tags"
      subtitle={queue ? `${queue.registration.challanNo ?? ""} · ${queue.registration.stockDate ?? ""}` : ""}
      footer={
        <>
          <span className="qrc2-left">{queue ? queue.untaggedSetCount + queue.untaggedLooseCount : 0} tags</span>
          <button className="qrc2-btn" onClick={onClose}>Cancel</button>
          <button className="qrc2-btn qrc2-pri" disabled={isLoading || submitting || !queue?.untaggedStockItemIds?.length} onClick={handlePrint}>
            Print tags
          </button>
        </>
      }
    >
      <div className="qrc2-callout qrc2-warn">
        <b>Tags for this batch were skipped at stock-in.</b> The stock is already registered — printing now only produces the missing labels.
      </div>
      {queue && (
        <div className="qrc2-fg">
          <label>Generation queue</label>
          <div className="qrc2-qt">
            <table>
              <thead><tr><th>Sets/semi sets</th><th>Loose</th><th>Total</th></tr></thead>
              <tbody>
                <tr>
                  <td>{queue.untaggedSetCount}</td>
                  <td>{queue.untaggedLooseCount}</td>
                  <td>{queue.untaggedSetCount + queue.untaggedLooseCount}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Drawer>
  );
}
```

This is intentionally simpler than the reference's parent+child/loose-only strategy radio — Task 4's `getBatchQueue` as specified returns flat set/loose counts, not a parent+child breakdown, because that breakdown logic lives in `stockPieceExpansion.service.js` and Task 4 Step 1 defers to whatever that service already exposes. **Before finalizing this component**, check what Task 4 actually ended up returning (if it reused a richer per-variant/per-size shape from `stockPieceExpansion.service.js`, extend this table and add the strategy radio to match the reference exactly, following the same radio/table pattern already implemented in the Stock-In wizard's `StrategyCards.jsx` + `GenerationQueue.jsx` — port their structure here rather than reinventing it, since it's the same underlying computation).

- [ ] **Step 3: Verify**

`npm run build`/lint passes. Full behavioral verification happens in Task 10 once wired into the page.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/inventory/components/qrCenter2/drawer frontend/src/features/inventory/services/qrCenter.api.js
git commit -m "feat(qr-center): add reprint drawer and configure-batch drawer"
```

---

### Task 10: History section + page assembly

**Files:**
- Create: `frontend/src/features/inventory/components/qrCenter2/history/HistorySection.jsx`
- Create: `frontend/src/features/inventory/components/qrCenter2/history/HistoryFilterBar.jsx`
- Create: `frontend/src/features/inventory/components/qrCenter2/history/HistoryRow.jsx`
- Create: `frontend/src/features/inventory/components/qrCenter2/QrCenterHeader.jsx`
- Modify: `frontend/src/features/inventory/pages/QrCenter.jsx`

- [ ] **Step 1: `HistoryRow.jsx`**

```jsx
import { Pill } from "../shared/pills";

const PILL = { done: ["ok", "printed"], partial: ["part", "of"], pending: ["warn", "Not printed"] };

export default function HistoryRow({ row, onConfigure, onView }) {
  const [tone] = PILL[row.printStatus] ?? ["neu", ""];
  return (
    <div className={`qrc2-hrow${row.printStatus !== "done" ? " qrc2-alert" : ""}`}>
      <div><div className="qrc2-b1">{row.challanNo ?? `#${row.registrationId}`}</div><div className="qrc2-b2">{row.displayDate}</div></div>
      <div>{row.design.code} {row.variant.colorName}<div className="qrc2-b2">{row.design.name}</div></div>
      <div className="qrc2-num">{row.typeCounts.SET} <span>sets</span></div>
      <div className="qrc2-num">{row.totalCount} <span>tags</span></div>
      <div><Pill tone={tone}>{row.printStatus === "partial" ? `${row.printedCount} of ${row.totalCount}` : row.printStatus === "done" ? `${row.printedCount} printed` : "Not printed"}</Pill></div>
      <div className="qrc2-hact">
        {row.printStatus === "done"
          ? <button className="qrc2-btn qrc2-sm" onClick={() => onView(row)}>View tags</button>
          : <button className="qrc2-btn qrc2-sm qrc2-dark" onClick={() => onConfigure(row)}>Configure &amp; print</button>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `HistoryFilterBar.jsx`** — same shape as Task 8's `FilterBar.jsx` but for history's param set (`keyword`, `designId`, `colorVariantId`, `dateFrom`/`dateTo` as a single `days`-style select for simplicity, `sort`) plus the four status-tab segmented control (`all`/`pending`/`partial`/`done` mapped to the reference's "All/Not printed/Partially printed/Fully printed").

Build this by copying `FilterBar.jsx`'s structure (same `<select>` pattern) plus a `.qrc2-seg` segmented-button row:

```jsx
const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Not printed" },
  { value: "partial", label: "Partially printed" },
  { value: "done", label: "Fully printed" },
];

export default function HistoryFilterBar({ statusFilter, onStatusChange, ...filterBarProps }) {
  return (
    <>
      {/* reuse the same select markup as search/FilterBar.jsx here, adapted for keyword/designId/colorVariantId/sort */}
      <div className="qrc2-seg">
        {STATUS_TABS.map((t) => (
          <button key={t.value} className={statusFilter === t.value ? "qrc2-on" : ""} onClick={() => onStatusChange(t.value)}>{t.label}</button>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: `HistorySection.jsx`** — wires `listRegistrations` (Task 2, existing `getQrCenterListApi`) with the filters, does client-side status-tab filtering on the already-fetched page (since `printStatus` is computed server-side per Task 2 but the existing `listQrCenterQuerySchema` doesn't have a `status` param — either add one in a Task 2 follow-up, or filter client-side on the current page's `data[]`; for a first cut, filter client-side to avoid another backend round-trip, and note this as a known limitation if the registration count ever exceeds one page)

```jsx
import { useState } from "react";
import { useQrCenterListApi } from "../../../hooks/useQrCenterListApi";
import HistoryFilterBar from "./HistoryFilterBar";
import HistoryRow from "./HistoryRow";

export default function HistorySection({ onConfigure, onView }) {
  const [filters, setFilters] = useState({ keyword: "", designId: "", colorVariantId: "", sort: "new" });
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: response, isLoading } = useQrCenterListApi({ ...filters, limit: 50 });
  const rows = (response?.data ?? []).filter((r) => statusFilter === "all" || r.printStatus === statusFilter);

  return (
    <div className="qrc2-sheet">
      <h2 className="qrc2-sec">Stock-in history</h2>
      <p className="qrc2-sec-sub">Every inward batch and what was printed for it.</p>
      <HistoryFilterBar filters={filters} onChange={setFilters} statusFilter={statusFilter} onStatusChange={setStatusFilter} />
      <div className="qrc2-hwrap">
        {isLoading ? <div className="qrc2-empty">Loading…</div> : rows.map((row) => (
          <HistoryRow key={`${row.registrationType}-${row.registrationId}`} row={row} onConfigure={onConfigure} onView={onView} />
        ))}
      </div>
    </div>
  );
}
```

Check whether `useQrCenterListApi` already exists (research section 3 listed it as one of the existing hooks) and its exact param names before finalizing the `useQrCenterListApi({...filters, limit: 50})` call — confirm it forwards arbitrary params through to `getQrCenterListApi` (research quoted `getQrCenterListApi`'s signature as `{page, limit, keyword}` only — it will need widening to also forward `designId`, `colorVariantId`, `sort` the same way `qrCenterSearch.api.js`'s `request()` helper does; either widen `getQrCenterListApi` in place in `qrCenter.api.js`, or note that as part of this step).

- [ ] **Step 4: `QrCenterHeader.jsx`**

```jsx
export default function QrCenterHeader() {
  return (
    <div className="qrc2-sheet">
      <h1>QR Center</h1>
      <p className="qrc2-sub">Look up any tag, reprint it, and print batches whose tags were skipped at stock-in.</p>
    </div>
  );
}
```

- [ ] **Step 5: Rebuild `pages/QrCenter.jsx`**

```jsx
import { useState } from "react";
import "../qrCenter2.theme.css";
import QrCenterHeader from "../components/qrCenter2/QrCenterHeader";
import SearchBar from "../components/qrCenter2/search/SearchBar";
import FilterBar from "../components/qrCenter2/search/FilterBar";
import ResultList from "../components/qrCenter2/search/ResultList";
import TagDetail from "../components/qrCenter2/search/TagDetail";
import HistorySection from "../components/qrCenter2/history/HistorySection";
import ReprintDrawer from "../components/qrCenter2/drawer/ReprintDrawer";
import ConfigureBatchDrawer from "../components/qrCenter2/drawer/ConfigureBatchDrawer";
import { useQrCenterSearchApi } from "../hooks/useQrCenterSearchApi";
import { useQrCenterResolveApi } from "../hooks/useQrCenterResolveApi";
import { useDesignsApi } from "../../design/hooks/useDesignsApi"; // confirm actual path/name before use

const EMPTY_FILTERS = { designId: "", colorVariantId: "", type: "", days: "" };

export default function QrCenter() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedCode, setSelectedCode] = useState(null);
  const [reprintTargets, setReprintTargets] = useState(null);
  const [configureBatchId, setConfigureBatchId] = useState(null);

  const hasQuery = !!(query || filters.designId || filters.colorVariantId || filters.type || filters.days);
  const { data: searchResponse, isFetching } = useQrCenterSearchApi(
    { keyword: query, ...filters, limit: 30 },
    { enabled: hasQuery && !selectedCode }
  );
  const { data: resolveResponse } = useQrCenterResolveApi(selectedCode, { enabled: !!selectedCode });

  return (
    <div className="qrc2-scope-2">
      <QrCenterHeader />

      <div className="qrc2-sheet">
        <SearchBar value={query} onChange={(v) => { setQuery(v); setSelectedCode(null); }} placeholder="Search by set ID, piece ID, design code or challan no." />
        <FilterBar filters={filters} onChange={(f) => { setFilters(f); setSelectedCode(null); }} onClear={() => setFilters(EMPTY_FILTERS)} resultCount={searchResponse?.meta?.total ?? 0} showCount={hasQuery} />
        {selectedCode ? (
          <TagDetail result={resolveResponse?.data} onBack={(nextCode) => setSelectedCode(nextCode)} onRaiseReprint={(t) => setReprintTargets([t])} />
        ) : (
          <ResultList tags={searchResponse?.data ?? []} onSelect={setSelectedCode} loading={isFetching} hasQuery={hasQuery} />
        )}
      </div>

      <HistorySection onConfigure={(row) => setConfigureBatchId(row.registrationId)} onView={(row) => { /* navigate to existing QrGrid route */ window.location.assign(`/qr-center/${row.registrationId}`); }} />

      <ReprintDrawer open={!!reprintTargets} onClose={() => setReprintTargets(null)} targets={reprintTargets} onDone={() => setSelectedCode(null)} />
      <ConfigureBatchDrawer open={!!configureBatchId} onClose={() => setConfigureBatchId(null)} stockInTransactionId={configureBatchId} onDone={() => {}} />
    </div>
  );
}
```

Confirm `useQrCenterResolveApi`'s real signature (research confirmed it exists, trivial wrapper — check whether it takes `(code, options)` or just `(code)`) and adjust. Confirm whether a `useDesignsApi`/equivalent hook already exists for populating `FilterBar`'s design/variant dropdowns (check `frontend/src/features/design/hooks/`) — if none exists in a directly reusable shape, it's acceptable to fetch designs via whatever the Design Master page already uses, imported read-only here; do not build a new designs-listing endpoint for this (out of scope, existing Design Master already has one).

- [ ] **Step 6: Verify — full manual walkthrough**

Run the frontend dev server, navigate to `/qr-center`, and confirm:
1. Page loads with new header, search bar, filters, empty state ("Search or filter to begin").
2. Typing a real design code or short code shows real results (not empty, not erroring) in the new list styling.
3. Clicking a result shows `TagDetail` with real fields (inward batch/date may show "—" for older records — expected).
4. Clicking "Reprint this tag" opens the reprint drawer, reason selection works, checkbox gates the Print button, and clicking Print actually calls the backend (watch Network tab: `POST /qr-center/reprints` then `POST /qr-center/reprints/bulk-print`) and the drawer closes.
5. Stock-in history section loads real rows below, with correct printed/partial/pending pills.
6. Clicking "Configure & print" on a partial/pending row opens the batch drawer with real counts from `/qr-center/<id>/queue`, and clicking "Print tags" calls `POST /qr-center/generate` and the drawer closes.
7. Clicking "View tags" on a fully-printed row navigates to the existing `/qr-center/:stockInTransactionId` `QrGrid` page (unchanged, still works).
8. Resize the browser to a narrow width — confirm no horizontal overflow/breakage (reference's own `@media (max-width:1000px)`/`(max-width:760px)` rules, ported into `qrCenter2.theme.css` Task 6, should already handle this — visually confirm).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/inventory/components/qrCenter2/history frontend/src/features/inventory/components/qrCenter2/QrCenterHeader.jsx frontend/src/features/inventory/pages/QrCenter.jsx
git commit -m "feat(qr-center): assemble redesigned QR Center page"
```

---

### Task 11: Delete the old QR Center tree

**Only do this after Task 10 Step 6's manual walkthrough passes.**

**Files to delete:**
- `frontend/src/features/inventory/components/qrCenter/resolver/`
- `frontend/src/features/inventory/components/qrCenter/health/`
- `frontend/src/features/inventory/components/qrCenter/queues/`
- `frontend/src/features/inventory/components/qrCenter/bulk/`
- `frontend/src/features/inventory/components/qrCenter/library/`
- `frontend/src/features/inventory/components/qrCenter/modals/`
- `frontend/src/features/inventory/components/qrCenter/OfflineQueuePill.jsx`
- `frontend/src/features/inventory/qrCenter.theme.css`
- `frontend/src/features/inventory/hooks/useQrCenterHealthApi.js`
- `frontend/src/features/inventory/hooks/useQrCenterToTagApi.js`
- `frontend/src/features/inventory/hooks/useQrCenterStaleApi.js`
- `frontend/src/features/inventory/hooks/useQrCenterRecoveryApi.js`
- `frontend/src/features/inventory/hooks/useQrCenterJobsApi.js`
- `frontend/src/features/inventory/hooks/useBulkGenerateApi.js`
- `frontend/src/features/inventory/hooks/usePrintCheckApi.js` — **keep if Task 9 Step 1 ended up importing a hook version instead of the raw `printCheckApi` function; check before deleting.**
- `frontend/src/features/inventory/hooks/useQrCenterPrintGuards.js`

**Do NOT delete** (still used by `QrGrid.jsx`/`StockTransformation.jsx`, out of this redesign's scope): `frontend/src/features/inventory/components/qr-center/` (the older, differently-named folder — note singular hyphen vs `qrCenter`), `frontend/src/features/inventory/pages/QrGrid.jsx`, and any `qrCenter.api.js` functions still called by the new tree (`resolveQrCenterCodeApi`, `getQrCenterListApi`, `getQrCenterRegistrationDetailApi`, `createQrCenterReprintApi`, `bulkPrintReprintsApi`, `getQrCenterReferenceApi`, `printCheckApi`, `generateQrApi`) — only remove the API functions that were exclusively used by deleted components (`getQrCenterToTagApi`, `getQrCenterStaleApi`, `reprintStaleApi`, `acceptStaleApi`, `getQrCenterRecoveryApi`, `createRecoveryEntryApi`, `assignRecoveryIdentityApi`, `getQrCenterJobsApi`, `reprintJobRangeApi`, `verifyJobSampleApi`, `breakSetApi`, `bulkGenerateApi`) — grep for each function name across `frontend/src` before deleting its export to confirm zero remaining callers.

- [ ] **Step 1: Delete files listed above**

```bash
git rm -r frontend/src/features/inventory/components/qrCenter/resolver frontend/src/features/inventory/components/qrCenter/health frontend/src/features/inventory/components/qrCenter/queues frontend/src/features/inventory/components/qrCenter/bulk frontend/src/features/inventory/components/qrCenter/library frontend/src/features/inventory/components/qrCenter/modals frontend/src/features/inventory/components/qrCenter/OfflineQueuePill.jsx frontend/src/features/inventory/qrCenter.theme.css frontend/src/features/inventory/hooks/useQrCenterHealthApi.js frontend/src/features/inventory/hooks/useQrCenterToTagApi.js frontend/src/features/inventory/hooks/useQrCenterStaleApi.js frontend/src/features/inventory/hooks/useQrCenterRecoveryApi.js frontend/src/features/inventory/hooks/useQrCenterJobsApi.js frontend/src/features/inventory/hooks/useBulkGenerateApi.js frontend/src/features/inventory/hooks/useQrCenterPrintGuards.js
```

(Add `usePrintCheckApi.js` to this list only if confirmed unused per the note above.)

- [ ] **Step 2: Grep for dangling imports**

```bash
grep -rn "components/qrCenter/resolver\|components/qrCenter/health\|components/qrCenter/queues\|components/qrCenter/bulk\|components/qrCenter/library\|components/qrCenter/modals\|useQrCenterHealthApi\|useQrCenterToTagApi\|useQrCenterStaleApi\|useQrCenterRecoveryApi\|useQrCenterJobsApi\|useBulkGenerateApi\|useQrCenterPrintGuards" frontend/src
```

Expected: zero matches. Fix any that show up (should only be within the just-deleted files themselves, i.e. zero real matches, if Task 10 was done correctly).

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```

Expected: succeeds with no missing-module errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(qr-center): remove old QR Center dashboard components"
```

---

### Task 12: Final cross-check against spec + demo-data grep

- [ ] **Step 1: Grep for reference-HTML demo data leaking into production code**

```bash
grep -rn "TAGS\b\|HIST\b\|SET-KP100\|JWO-8942\|KP100\|KP240\|KP315" frontend/src/features/inventory/components/qrCenter2 frontend/src/features/inventory/pages/QrCenter.jsx
```

Expected: zero matches. If any show up, remove them — they mean a demo literal was copy-pasted instead of mapped to a real prop.

- [ ] **Step 2: Re-read the user's spec (sections 4-14) one item at a time and confirm a shipped component covers it**

Go through: search (Task 8), filters (Task 8), tag detail (Task 8), tag types (Task 8's `KindBadge`/`TagPreviewLabel`), reprint selection + drawer (Task 9), stock-in history + status tabs (Task 10), configure & print (Task 9), tag content tabs (flagged as simplified in Task 9 Step 2 — revisit if the richer `stockPieceExpansion.service.js` shape was available), printer (Task 9's `defaultPrinter` from `getReference`), preview (Task 6/8's `TagPreviewLabel`), responsiveness (Task 6's ported media queries). Note any gap found and either fix it now or explicitly tell the user it's deferred and why.

- [ ] **Step 3: Confirm existing routes/pages untouched**

```bash
git diff --stat main
```

Expected: only files under `backend/src/modules/stock/{repositories,services,validators,routes,controllers}/` and `frontend/src/features/inventory/{pages/QrCenter.jsx,components/qrCenter2/**,components/qrCenter/**(deletions),hooks/**,services/**,qrCenter2.theme.css,qrCenter.theme.css(deletion)}` — nothing under `Design Master`, `Stock In` (other than the shared `qrCenter.api.js` additions), `Current Stock`, `Stock History`, `Stock Out`, `Stock Transformation`, `Order Forms`.

- [ ] **Step 4: Final commit (if Step 2 produced fixes)**

```bash
git add -A
git commit -m "fix(qr-center): close gaps found in final spec cross-check"
```

---

## Self-Review Notes (already applied above, kept here for the executor's awareness)

- **Spec coverage:** Every reference section (1-21 in the user's message) maps to a task above except sections 15 (responsive — Task 6/10), 17 (visual accuracy — Task 6's full class port), 19 (process — this plan itself), 20/21 (verification — Task 10 Step 6, Task 12) which are cross-cutting rather than single components.
- **Known deliberate simplification vs. the reference:** `ConfigureBatchDrawer` (Task 9) ships with flat set/loose counts unless Task 4's research into `stockPieceExpansion.service.js` turns up the richer per-variant breakdown already computed elsewhere — this is called out explicitly in both tasks rather than silently shipping a lesser version.
- **Known limitation:** `HistorySection`'s status-tab filtering (Task 10) is client-side on one fetched page rather than a server-side `status` query param — acceptable for now given `listQrCenterQuerySchema`'s existing `limit.max(100)` cap, called out so it isn't mistaken for an oversight later.
- **Type/name consistency check:** `stockItemId` (not `stockItemID`), `shortCode` (not `code` — except the raw resolve-by-code query param, which stays `code` since that's the existing, unchanged `resolveQuerySchema`), `printStatus` values are lowercase `"pending"|"partial"|"done"` used consistently from Task 2's service through Task 10's `HistoryRow`/`HistoryFilterBar`.
