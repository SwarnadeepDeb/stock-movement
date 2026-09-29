# Stock Out Rebuild — Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `parties` master-data module and the Stock Out shell, and remove the old Stock Out page, the quantity-based stock-out API, and the `modules/order/` order-form module.

**Architecture:** A new backend module `modules/sales/` (controller → service → repository → schema, routes as data for `routeBuilder.js`) exposes five `/api/v1/parties` endpoints. A new frontend feature `features/sales/` holds a subnav layout at `/stock-out`, a Party Master screen, and a party autocomplete built now for slices 2–3. Party names are unique on a normalized (trim + lowercase) column, the same way `color_variants` deduplicates colour names.

**Tech Stack:** Node 22 + Express 5, Drizzle ORM on Postgres, Zod 4, hand-written numbered SQL migrations. React 19 + Vite, react-router, TanStack Query + Table, Tailwind 4 with the app's neumorphic/glass utility classes, shadcn/ui primitives. Vitest + Supertest, added by this plan.

**Spec:** `docs/superpowers/specs/2026-09-28-stock-out-rebuild-slice1-design.md`

---

## File Structure

### Backend — created

| File | Responsibility |
|---|---|
| `backend/src/modules/sales/schemas/party.schema.js` | Drizzle table definition for `parties` |
| `backend/src/modules/sales/repositories/party.repository.js` | All SQL touching `parties`; owns name normalization |
| `backend/src/modules/sales/services/party.service.js` | Duplicate-name rules, transactions, not-found errors |
| `backend/src/modules/sales/mapper/partyMapper.js` | DB row → API shape |
| `backend/src/modules/sales/validators/party.validator.js` | Zod schemas for body/params/query |
| `backend/src/modules/sales/controllers/party.controller.js` | HTTP layer, `ApiResponse` wrapping |
| `backend/src/modules/sales/routes/party.route.js` | Route table for `buildRouter` |
| `backend/src/app/middlewares/role.middleware.js` | Reads `X-User-Role`; `requireOwner` guard |
| `backend/src/database/migrations/0006_add_parties.sql` | Creates `parties`, back-fills, renames old order tables |
| `backend/vitest.config.js` | Test runner config |
| `backend/tests/helpers/db.js` | Test DB truncation helper |
| `backend/tests/helpers/app.js` | Builds an Express app for Supertest |
| `backend/tests/sales/party.repository.test.js` | Normalization and search queries |
| `backend/tests/sales/party.service.test.js` | Duplicate rules, update, soft delete |
| `backend/tests/sales/party.routes.test.js` | Status codes and error codes |
| `backend/tests/middlewares/role.middleware.test.js` | Header parsing and `requireOwner` |

### Backend — modified / deleted

| File | Change |
|---|---|
| `backend/src/database/schema.js` | Drop three `modules/order/...` exports; add party export |
| `backend/src/app/routes/index.js` | Drop `/order-forms` and `/stock-out` mounts; add `/parties` |
| `backend/package.json` | Add `test` script and dev dependencies |
| `backend/src/modules/order/**` | Delete (15 files) |
| `backend/src/modules/stock/**/stockOut*` (7 files) | Delete — quantity-based path superseded by slice 3 |

`stock_out_transactions` / `stock_out_entries` schemas and repositories are **kept**: slice 3 writes to them and `stock_history.stock_out_transaction_id` references them.

### Frontend — created

| File | Responsibility |
|---|---|
| `frontend/src/features/sales/context/RoleContext.jsx` | Role state + `fetchWithRole` |
| `frontend/src/features/sales/layouts/StockOutLayout.jsx` | Subnav + role switch + `<Outlet/>` |
| `frontend/src/features/sales/pages/Overview.jsx` | Action cards, flow strip, party count |
| `frontend/src/features/sales/pages/Parties.jsx` | Party Master list + search |
| `frontend/src/features/sales/pages/SlicePlaceholder.jsx` | Panel for Orders/Invoices until slices 2–3 |
| `frontend/src/features/sales/table/PartyColumns.jsx` | DataTable column defs |
| `frontend/src/features/sales/components/PartyFormDialog.jsx` | Create/edit dialog |
| `frontend/src/features/sales/components/PartyPicker.jsx` | Autocomplete for slices 2–3 |
| `frontend/src/features/sales/services/party.api.js` | fetch wrappers |
| `frontend/src/features/sales/hooks/usePartiesApi.js` | List query |
| `frontend/src/features/sales/hooks/usePartyMutations.js` | Create/update/status mutations |

### Frontend — modified / deleted

| File | Change |
|---|---|
| `frontend/src/App.jsx` | Replace `/order-forms*` + `/stock-out` routes with the nested shell |
| `frontend/src/lib/getMenuList.js` | Remove Sales → Order Forms; Stock Out points at the shell |
| `frontend/src/main.jsx` | Wrap app in `RoleProvider` |
| `frontend/src/features/orderForms/**` | Delete (24 files) |
| `frontend/src/features/inventory/pages/StockOut.jsx` | Delete |
| `frontend/src/features/inventory/hooks/useStockOutRegisterApi.js`, `useVariantStockOutConfigs.js`, `services/stockOut.api.js` | Delete |

---

## Task 1: Test harness

**Files:**
- Modify: `backend/package.json`
- Create: `backend/vitest.config.js`, `backend/tests/helpers/db.js`, `backend/tests/helpers/app.js`, `backend/.env.test.example`

- [ ] **Step 1: Install dev dependencies**

```bash
cd backend && pnpm add -D vitest supertest
```

- [ ] **Step 2: Add the test script**

In `backend/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `backend/vitest.config.js`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        // Every suite talks to the same Postgres database and truncates between tests, so
        // parallel files would delete each other's rows mid-assertion.
        fileParallelism: false,
        setupFiles: ["./tests/helpers/env.js"],
        include: ["tests/**/*.test.js"],
    },
});
```

- [ ] **Step 4: Create `backend/tests/helpers/env.js`**

```js
// Loads .env.test if present, otherwise .env — so a developer with a single local database can
// run the suite without extra setup, while CI points TEST_DATABASE_URL somewhere disposable.
import "dotenv/config.js";
import { config } from "dotenv";

config({ path: ".env.test", override: true });

if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
```

- [ ] **Step 5: Create `backend/tests/helpers/db.js`**

```js
import { sql } from "drizzle-orm";
import { db } from "../../src/database/index.js";
import { closePool } from "../../src/database/connection.js";

// Truncates only the tables a suite names, rather than every table, so a developer running the
// suite against their development database doesn't lose their designs and stock.
export async function truncate(tables) {
    if (tables.length === 0) return;
    const list = tables.map((table) => `"${table}"`).join(", ");
    await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`));
}

export async function disconnect() {
    await closePool();
}

export { db };
```

- [ ] **Step 6: Create `backend/tests/helpers/app.js`**

```js
import express from "express";
import routes from "../../src/app/routes/index.js";
import errorHandler from "../../src/app/middlewares/error.middleware.js";
import { attachRole } from "../../src/app/middlewares/role.middleware.js";

// A minimal app with the same routing and error handling as src/app.js, minus helmet/cors/logging
// — so a route test exercises real middleware without the noise.
export function buildTestApp() {
    const app = express();
    app.use(express.json());
    app.use(attachRole);
    app.use("/api/v1", routes);
    app.use(errorHandler);
    return app;
}
```

`error.middleware.js` exports `errorHandler` as a default — hence the default import. `attachRole` does not exist until Task 5, so this helper cannot be imported before then; that is fine, nothing imports it yet.

- [ ] **Step 7: Create `backend/.env.test.example`**

```
# Copy to .env.test. Point this at a disposable database — the suite truncates tables.
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stock_mngmt_test
```

- [ ] **Step 8: Verify the runner starts**

Run: `cd backend && pnpm test`
Expected: exits successfully reporting "No test files found" (no suites exist yet).

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/pnpm-lock.yaml backend/vitest.config.js backend/tests backend/.env.test.example
git commit -m "test: add vitest + supertest harness"
```

---

## Task 2: `parties` table

**Files:**
- Create: `backend/src/modules/sales/schemas/party.schema.js`
- Modify: `backend/src/database/schema.js`

- [ ] **Step 1: Create the schema file**

```js
import { boolean, integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

// A saved customer. Order forms and invoices fill from here and can write changes back, but they
// also keep their own frozen copy of these fields (see the slice 1 design doc): a printed
// document must not change because someone later corrected a party's transport.
export const party = pgTable("parties", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    name: varchar("name", { length: 200 }).notNull(),

    // trim + lowercase form of `name`, computed in the repository before insert — backs the
    // unique index below, which is what makes "is this an existing party or a new one?"
    // decidable for the party autocomplete.
    normalizedName: varchar("normalized_name", { length: 200 }).notNull(),

    // All nullable: the party form marks only the name required, and a walk-in customer noted at
    // the counter often has no GST number or agent.
    mobile: varchar("mobile", { length: 20 }),
    city: varchar("city", { length: 100 }),
    gst: varchar("gst", { length: 20 }),
    transport: varchar("transport", { length: 200 }),
    agent: varchar("agent", { length: 100 }),

    // Soft delete: parties are referenced by documents, so a hard delete would orphan history.
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdateFn(() => new Date()),
},
    (table) => [
        uniqueIndex("parties_normalized_name_unique_idx").on(table.normalizedName),
    ]
);
```

- [ ] **Step 2: Register it and drop the order module's exports**

In `backend/src/database/schema.js`, delete these three lines:

```js
export * from "../modules/order/schemas/orderForm.schema.js";
export * from "../modules/order/schemas/orderFormItem.schema.js";
export * from "../modules/order/schemas/orderFormPhoto.schema.js";
```

and add:

```js
export * from "../modules/sales/schemas/party.schema.js";
```

- [ ] **Step 3: Verify the schema imports cleanly**

Run: `cd backend && node -e "import('./src/database/schema.js').then(m => console.log(Object.keys(m).filter(k => k.includes('party'))))"`
Expected: prints `[ 'party' ]`

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/sales/schemas/party.schema.js backend/src/database/schema.js
git commit -m "feat: add parties table schema"
```

---

## Task 3: Migration

**Files:**
- Create: `backend/src/database/migrations/0006_add_parties.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Slice 1 of the Stock Out rebuild: introduces the party master, migrates retailer identities
-- off the old order-form tables, and retires those tables by rename (not drop) so the change is
-- reversible.

CREATE TABLE "parties" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name" varchar(200) NOT NULL,
    "normalized_name" varchar(200) NOT NULL,
    "mobile" varchar(20),
    "city" varchar(100),
    "gst" varchar(20),
    "transport" varchar(200),
    "agent" varchar(100),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX "parties_normalized_name_unique_idx" ON "parties" ("normalized_name");

-- Back-fill one party per distinct normalized retailer name. DISTINCT ON picks that retailer's
-- most recent order form as the source of the display name and city, so the newest spelling and
-- location win. Runs before the rename below because the data is only reachable while the table
-- is still called order_forms. A no-op when order_forms is empty.
INSERT INTO "parties" ("name", "normalized_name", "city")
SELECT DISTINCT ON (lower(trim("retailer_name")))
    trim("retailer_name"),
    lower(trim("retailer_name")),
    nullif(trim(coalesce("location", '')), '')
FROM "order_forms"
WHERE trim(coalesce("retailer_name", '')) <> ''
ORDER BY lower(trim("retailer_name")), "created_at" DESC;

-- Retire the old order-form module's tables. Renamed rather than dropped: the application stops
-- referencing them the moment schema.js drops its exports, so this is equivalent from the code's
-- point of view, but recoverable. A later migration drops them once the rebuild is trusted.
ALTER TABLE "order_form_photos" RENAME TO "legacy_order_form_photos";
ALTER TABLE "order_form_items" RENAME TO "legacy_order_form_items";
ALTER TABLE "order_forms" RENAME TO "legacy_order_forms";
```

- [ ] **Step 2: Apply it**

Run: `cd backend && psql "$DATABASE_URL" -f src/database/migrations/0006_add_parties.sql`
Expected: `CREATE TABLE`, `CREATE INDEX`, `INSERT 0 N`, three `ALTER TABLE`.

If the project applies migrations another way (check `backend/readme.md`), use that instead.

- [ ] **Step 3: Verify the back-fill**

Run: `cd backend && psql "$DATABASE_URL" -c 'SELECT id, name, city FROM parties ORDER BY id'`
Expected: one row per distinct retailer that existed in `order_forms`; zero rows if it was empty.

- [ ] **Step 4: Commit**

```bash
git add backend/src/database/migrations/0006_add_parties.sql
git commit -m "feat: migration adding parties and retiring legacy order tables"
```

---

## Task 4: Party repository

**Files:**
- Create: `backend/src/modules/sales/repositories/party.repository.js`
- Test: `backend/tests/sales/party.repository.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import partyRepository from "../../src/modules/sales/repositories/party.repository.js";
import { db, disconnect, truncate } from "../helpers/db.js";

beforeEach(() => truncate(["parties"]));
afterAll(() => disconnect());

describe("partyRepository", () => {
    it("stores a trimmed, lowercased normalized name alongside the name as typed", async () => {
        const created = await partyRepository.create(db, { name: "  Meera Textiles  ", city: "Surat" });

        expect(created.name).toBe("Meera Textiles");
        expect(created.normalizedName).toBe("meera textiles");
    });

    it("finds a party by name regardless of case or surrounding whitespace", async () => {
        await partyRepository.create(db, { name: "Meera Textiles" });

        const found = await partyRepository.findByName(db, "  MEERA TEXTILES ");

        expect(found?.name).toBe("Meera Textiles");
    });

    it("excludes a given id from the name lookup, so a party can keep its own name on update", async () => {
        const created = await partyRepository.create(db, { name: "Meera Textiles" });

        const found = await partyRepository.findByName(db, "Meera Textiles", created.id);

        expect(found).toBeUndefined();
    });

    it("searches name, mobile, city and gst", async () => {
        await partyRepository.create(db, { name: "Meera Textiles", mobile: "98250 11210", city: "Surat", gst: "24AAECM1234F1Z5" });
        await partyRepository.create(db, { name: "Rani Wholesale", mobile: "96011 47110", city: "Rajkot", gst: "24AAPCR5678H1Z2" });

        const byCity = await partyRepository.findMany(db, { limit: 10, offset: 0, keyword: "rajkot" });
        const byGst = await partyRepository.findMany(db, { limit: 10, offset: 0, keyword: "AAECM" });
        const byMobile = await partyRepository.findMany(db, { limit: 10, offset: 0, keyword: "96011" });

        expect(byCity.map((p) => p.name)).toEqual(["Rani Wholesale"]);
        expect(byGst.map((p) => p.name)).toEqual(["Meera Textiles"]);
        expect(byMobile.map((p) => p.name)).toEqual(["Rani Wholesale"]);
    });

    it("counts only rows matching the filter", async () => {
        await partyRepository.create(db, { name: "Meera Textiles", city: "Surat" });
        await partyRepository.create(db, { name: "Rani Wholesale", city: "Rajkot" });

        expect(await partyRepository.count(db, { keyword: "surat" })).toBe(1);
        expect(await partyRepository.count(db, {})).toBe(2);
    });

    it("updates a name and its normalized form together", async () => {
        const created = await partyRepository.create(db, { name: "Meera Textiles" });

        const updated = await partyRepository.update(db, created.id, { name: "Meera Textiles Pvt Ltd" });

        expect(updated.normalizedName).toBe("meera textiles pvt ltd");
    });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && pnpm test tests/sales/party.repository.test.js`
Expected: FAIL — cannot resolve `party.repository.js`.

- [ ] **Step 3: Write the repository**

```js
import { and, asc, count, eq, ilike, ne, or } from "drizzle-orm";

import { db } from "../../../database/index.js";
import { party } from "../schemas/party.schema.js";

// The single definition of how a party name is compared. Normalization lives here rather than in
// the service so no write path can reach the table without going through it.
export function normalizeName(name) {
    return String(name ?? "").trim().toLowerCase();
}

function buildFilters({ keyword, includeInactive }) {
    const conditions = [];

    if (!includeInactive) conditions.push(eq(party.isActive, true));

    if (keyword) {
        conditions.push(or(
            ilike(party.name, `%${keyword}%`),
            ilike(party.mobile, `%${keyword}%`),
            ilike(party.city, `%${keyword}%`),
            ilike(party.gst, `%${keyword}%`),
        ));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
}

class PartyRepository {
    async create(runner, data) {
        const name = String(data.name).trim();

        const [result] = await runner.insert(party).values({
            ...data,
            name,
            normalizedName: normalizeName(name),
        }).returning();

        return result;
    }

    async update(runner, id, data) {
        const patch = { ...data, updatedAt: new Date() };

        if (data.name !== undefined) {
            patch.name = String(data.name).trim();
            patch.normalizedName = normalizeName(patch.name);
        }

        const [result] = await runner.update(party).set(patch).where(eq(party.id, id)).returning();

        return result;
    }

    async setActive(runner, id, isActive) {
        const [result] = await runner.update(party)
            .set({ isActive, updatedAt: new Date() })
            .where(eq(party.id, id))
            .returning();

        return result;
    }

    async findById(runner, id) {
        const [result] = await runner.select().from(party).where(eq(party.id, id)).limit(1);

        return result;
    }

    // `excludeId` lets an update keep its own name without colliding with itself.
    async findByName(runner, name, excludeId) {
        const conditions = [eq(party.normalizedName, normalizeName(name))];
        if (excludeId) conditions.push(ne(party.id, excludeId));

        const [result] = await runner.select().from(party).where(and(...conditions)).limit(1);

        return result;
    }

    async findMany(runner, { limit, offset, keyword, includeInactive }) {
        return runner.select().from(party)
            .where(buildFilters({ keyword, includeInactive }))
            .orderBy(asc(party.name))
            .limit(limit)
            .offset(offset);
    }

    async count(runner, { keyword, includeInactive } = {}) {
        const [result] = await runner.select({ value: count() }).from(party)
            .where(buildFilters({ keyword, includeInactive }));

        return result.value;
    }
}

export default new PartyRepository();
```

Every method takes a `runner` (either `db` or a transaction) as its first argument, matching `orderForm.repository.js` — that is what lets the service wrap a duplicate check and an insert in one transaction.

- [ ] **Step 4: Run the tests**

Run: `cd backend && pnpm test tests/sales/party.repository.test.js`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/sales/repositories/party.repository.js backend/tests/sales/party.repository.test.js
git commit -m "feat: add party repository with normalized-name lookups"
```

---

## Task 5: Role middleware

**Files:**
- Create: `backend/src/app/middlewares/role.middleware.js`
- Test: `backend/tests/middlewares/role.middleware.test.js`

Slice 1 applies this to no route. It exists now so slice 3's owner-only invoice edit has a guard to reach for, and so the stand-in has exactly one place to be replaced when real auth arrives.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it, vi } from "vitest";
import { attachRole, requireOwner, ROLES } from "../../src/app/middlewares/role.middleware.js";

function runAttach(headers) {
    const req = { get: (name) => headers[name.toLowerCase()] };
    const next = vi.fn();
    attachRole(req, {}, next);
    return { req, next };
}

describe("attachRole", () => {
    it("reads a recognised role from the X-User-Role header", () => {
        const { req, next } = runAttach({ "x-user-role": "owner" });

        expect(req.userRole).toBe(ROLES.OWNER);
        expect(next).toHaveBeenCalledWith();
    });

    it("is case insensitive", () => {
        const { req } = runAttach({ "x-user-role": "OWNER" });

        expect(req.userRole).toBe(ROLES.OWNER);
    });

    it("defaults to staff when the header is absent", () => {
        const { req } = runAttach({});

        expect(req.userRole).toBe(ROLES.STAFF);
    });

    it("defaults to staff when the header is unrecognised, never trusting an unknown value", () => {
        const { req } = runAttach({ "x-user-role": "administrator" });

        expect(req.userRole).toBe(ROLES.STAFF);
    });
});

describe("requireOwner", () => {
    it("passes an owner through", () => {
        const next = vi.fn();

        requireOwner({ userRole: ROLES.OWNER }, {}, next);

        expect(next).toHaveBeenCalledWith();
    });

    it("rejects staff with 403 OWNER_ONLY", () => {
        const next = vi.fn();

        requireOwner({ userRole: ROLES.STAFF }, {}, next);

        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(403);
        expect(error.code).toBe("OWNER_ONLY");
    });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && pnpm test tests/middlewares/role.middleware.test.js`
Expected: FAIL — cannot resolve `role.middleware.js`.

- [ ] **Step 3: Write the middleware**

```js
import ApiError from "../../core/apiError.js";

export const ROLES = { STAFF: "staff", OWNER: "owner" };

const KNOWN_ROLES = new Set(Object.values(ROLES));

// Stand-in for real authentication: the client states its own role in a header, and this is the
// single place that reads it. There is no users table and no session yet — when one arrives, only
// this function changes, and every guard built on req.userRole keeps working.
//
// Unrecognised values fall back to staff rather than erroring: the safe default is the role with
// fewer powers, and a typo'd header should not take the application down.
export const attachRole = (req, res, next) => {
    const header = req.get("X-User-Role");
    const candidate = String(header ?? "").trim().toLowerCase();

    req.userRole = KNOWN_ROLES.has(candidate) ? candidate : ROLES.STAFF;
    next();
};

export const requireOwner = (req, res, next) => {
    if (req.userRole === ROLES.OWNER) return next();

    next(new ApiError("Only the owner can perform this action.", 403, "OWNER_ONLY"));
};
```

- [ ] **Step 4: Wire `attachRole` into the app**

In `backend/src/app.js`, import it and mount it just before the routes:

```js
import { attachRole } from "./app/middlewares/role.middleware.js";
```

```js
app.use(attachRole);

// application routes
app.use("/api/v1", router);
```

- [ ] **Step 5: Run the tests**

Run: `cd backend && pnpm test tests/middlewares/role.middleware.test.js`
Expected: 6 passing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app/middlewares/role.middleware.js backend/src/app.js backend/tests/middlewares/role.middleware.test.js
git commit -m "feat: add role middleware with owner guard"
```

---

## Task 6: Party service and mapper

**Files:**
- Create: `backend/src/modules/sales/mapper/partyMapper.js`, `backend/src/modules/sales/services/party.service.js`
- Test: `backend/tests/sales/party.service.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import partyService from "../../src/modules/sales/services/party.service.js";
import { disconnect, truncate } from "../helpers/db.js";

beforeEach(() => truncate(["parties"]));
afterAll(() => disconnect());

const MEERA = { name: "Meera Textiles", mobile: "98250 11210", city: "Surat", gst: "24AAECM1234F1Z5", transport: "Shree Balaji Roadways", agent: "Ramesh Bhai" };

describe("partyService.createParty", () => {
    it("returns the created party in API shape", async () => {
        const created = await partyService.createParty(MEERA);

        expect(created).toMatchObject({ name: "Meera Textiles", city: "Surat", isActive: true });
        expect(created.id).toBeTypeOf("number");
        expect(created).not.toHaveProperty("normalizedName");
    });

    it("rejects an exact duplicate name with 409 PARTY_NAME_EXISTS", async () => {
        await partyService.createParty(MEERA);

        await expect(partyService.createParty(MEERA)).rejects.toMatchObject({ statusCode: 409, code: "PARTY_NAME_EXISTS" });
    });

    it("rejects a duplicate differing only in case", async () => {
        await partyService.createParty(MEERA);

        await expect(partyService.createParty({ name: "MEERA TEXTILES" }))
            .rejects.toMatchObject({ code: "PARTY_NAME_EXISTS" });
    });

    it("rejects a duplicate differing only in surrounding whitespace", async () => {
        await partyService.createParty(MEERA);

        await expect(partyService.createParty({ name: "  Meera Textiles  " }))
            .rejects.toMatchObject({ code: "PARTY_NAME_EXISTS" });
    });
});

describe("partyService.updateParty", () => {
    it("applies a patch", async () => {
        const created = await partyService.createParty(MEERA);

        const updated = await partyService.updateParty(created.id, { ...MEERA, transport: "Gujarat Cargo Movers" });

        expect(updated.transport).toBe("Gujarat Cargo Movers");
    });

    it("lets a party keep its own name", async () => {
        const created = await partyService.createParty(MEERA);

        const updated = await partyService.updateParty(created.id, { ...MEERA, city: "Navsari" });

        expect(updated.city).toBe("Navsari");
    });

    it("rejects renaming onto another party's name", async () => {
        const created = await partyService.createParty(MEERA);
        await partyService.createParty({ name: "Rani Wholesale" });

        await expect(partyService.updateParty(created.id, { name: "Rani Wholesale" }))
            .rejects.toMatchObject({ statusCode: 409, code: "PARTY_NAME_EXISTS" });
    });

    it("404s on an unknown id", async () => {
        await expect(partyService.updateParty(999999, { name: "Nobody" }))
            .rejects.toMatchObject({ statusCode: 404, code: "PARTY_NOT_FOUND" });
    });
});

describe("partyService.setStatus", () => {
    it("soft deletes and restores", async () => {
        const created = await partyService.createParty(MEERA);

        const deactivated = await partyService.setStatus(created.id, false);
        expect(deactivated.isActive).toBe(false);

        const restored = await partyService.setStatus(created.id, true);
        expect(restored.isActive).toBe(true);
    });

    it("hides inactive parties from the default listing but keeps them findable", async () => {
        const created = await partyService.createParty(MEERA);
        await partyService.setStatus(created.id, false);

        const active = await partyService.listParties({ page: 1, limit: 10 });
        const all = await partyService.listParties({ page: 1, limit: 10, includeInactive: true });

        expect(active.data).toHaveLength(0);
        expect(all.data).toHaveLength(1);
    });
});

describe("partyService.listParties", () => {
    it("paginates and reports totals in meta", async () => {
        await partyService.createParty({ name: "Anjali Collections" });
        await partyService.createParty({ name: "Meera Textiles" });
        await partyService.createParty({ name: "Rani Wholesale" });

        const page = await partyService.listParties({ page: 1, limit: 2 });

        expect(page.data.map((p) => p.name)).toEqual(["Anjali Collections", "Meera Textiles"]);
        expect(page.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    });

    it("filters by keyword", async () => {
        await partyService.createParty(MEERA);
        await partyService.createParty({ name: "Rani Wholesale", city: "Rajkot" });

        const found = await partyService.listParties({ page: 1, limit: 10, q: "rajkot" });

        expect(found.data.map((p) => p.name)).toEqual(["Rani Wholesale"]);
    });
});

describe("partyService.getParty", () => {
    it("404s on an unknown id", async () => {
        await expect(partyService.getParty(999999)).rejects.toMatchObject({ statusCode: 404, code: "PARTY_NOT_FOUND" });
    });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && pnpm test tests/sales/party.service.test.js`
Expected: FAIL — cannot resolve `party.service.js`.

- [ ] **Step 3: Write the mapper**

```js
// DB row → API shape. normalizedName is an implementation detail of uniqueness and never leaves
// the server; everything else is surfaced as-is.
class PartyMapper {
    map(row) {
        if (!row) return null;

        return {
            id: row.id,
            name: row.name,
            mobile: row.mobile ?? "",
            city: row.city ?? "",
            gst: row.gst ?? "",
            transport: row.transport ?? "",
            agent: row.agent ?? "",
            isActive: row.isActive,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    mapMany(rows) {
        return rows.map((row) => this.map(row));
    }
}

export default new PartyMapper();
```

Nullable fields are mapped to `""` rather than `null` because every consumer is a text input, and an input whose value is `null` is a React warning waiting to happen.

- [ ] **Step 4: Write the service**

```js
import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import partyRepository from "../repositories/party.repository.js";
import partyMapper from "../mapper/partyMapper.js";

const PARTY_FIELDS = ["name", "mobile", "city", "gst", "transport", "agent"];

// Turns "" into null: an empty text input means "not recorded", and storing "" would make
// "has no GST" and "GST is the empty string" two different states in the database.
function normalizePayload(payload) {
    const row = {};

    for (const field of PARTY_FIELDS) {
        if (payload[field] === undefined) continue;
        const value = String(payload[field]).trim();
        row[field] = field === "name" ? value : (value === "" ? null : value);
    }

    return row;
}

// Postgres raises 23505 on the parties_normalized_name_unique_idx when two requests race past the
// service's own check. Both paths must report the same thing to the client.
function isUniqueViolation(error) {
    return error?.code === "23505" || error?.originalError?.code === "23505";
}

function duplicateError(name) {
    return new ApiError(`${name} already exists in Party Master.`, 409, "PARTY_NAME_EXISTS");
}

class PartyService {
    _partyRepository = partyRepository;
    _partyMapper = partyMapper;

    async createParty(payload) {
        const row = normalizePayload(payload);

        try {
            // The check and the insert share one transaction, so two concurrent creates cannot
            // both see "no duplicate" and both proceed.
            const created = await db.transaction(async (tx) => {
                const existing = await this._partyRepository.findByName(tx, row.name);
                if (existing) throw duplicateError(row.name);

                return this._partyRepository.create(tx, row);
            });

            return this._partyMapper.map(created);
        } catch (error) {
            if (isUniqueViolation(error)) throw duplicateError(row.name);
            throw error;
        }
    }

    async updateParty(id, payload) {
        const partyId = Number(id);
        const row = normalizePayload(payload);

        try {
            const updated = await db.transaction(async (tx) => {
                const existing = await this._partyRepository.findById(tx, partyId);
                if (!existing) throw new ApiError(`Party ${partyId} not found.`, 404, "PARTY_NOT_FOUND");

                if (row.name !== undefined) {
                    const clash = await this._partyRepository.findByName(tx, row.name, partyId);
                    if (clash) throw duplicateError(row.name);
                }

                return this._partyRepository.update(tx, partyId, row);
            });

            return this._partyMapper.map(updated);
        } catch (error) {
            if (isUniqueViolation(error)) throw duplicateError(row.name);
            throw error;
        }
    }

    async setStatus(id, isActive) {
        const partyId = Number(id);

        const existing = await this._partyRepository.findById(db, partyId);
        if (!existing) throw new ApiError(`Party ${partyId} not found.`, 404, "PARTY_NOT_FOUND");

        const updated = await this._partyRepository.setActive(db, partyId, isActive);

        return this._partyMapper.map(updated);
    }

    async getParty(id) {
        const partyId = Number(id);

        const existing = await this._partyRepository.findById(db, partyId);
        if (!existing) throw new ApiError(`Party ${partyId} not found.`, 404, "PARTY_NOT_FOUND");

        return this._partyMapper.map(existing);
    }

    async listParties({ page = 1, limit = 50, q, includeInactive = false } = {}) {
        const offset = (page - 1) * limit;
        const filters = { keyword: q?.trim() || undefined, includeInactive };

        const [rows, total] = await Promise.all([
            this._partyRepository.findMany(db, { limit, offset, ...filters }),
            this._partyRepository.count(db, filters),
        ]);

        return {
            data: this._partyMapper.mapMany(rows),
            meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        };
    }

    // Used by the Stock Out overview tile.
    async countParties() {
        return this._partyRepository.count(db, {});
    }
}

export default new PartyService();
```

- [ ] **Step 5: Run the tests**

Run: `cd backend && pnpm test tests/sales/party.service.test.js`
Expected: 13 passing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/sales/services backend/src/modules/sales/mapper backend/tests/sales/party.service.test.js
git commit -m "feat: add party service with duplicate-name rules"
```

---

## Task 7: Validators, controller, routes

**Files:**
- Create: `backend/src/modules/sales/validators/party.validator.js`, `backend/src/modules/sales/controllers/party.controller.js`, `backend/src/modules/sales/routes/party.route.js`
- Modify: `backend/src/app/routes/index.js`
- Test: `backend/tests/sales/party.routes.test.js`

- [ ] **Step 1: Write the failing test**

```js
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { disconnect, truncate } from "../helpers/db.js";

const app = buildTestApp();

beforeEach(() => truncate(["parties"]));
afterAll(() => disconnect());

const MEERA = { name: "Meera Textiles", mobile: "98250 11210", city: "Surat", gst: "24AAECM1234F1Z5", transport: "Shree Balaji Roadways", agent: "Ramesh Bhai" };

async function createMeera() {
    const response = await request(app).post("/api/v1/parties").send(MEERA);
    return response.body.data;
}

describe("POST /api/v1/parties", () => {
    it("creates a party", async () => {
        const response = await request(app).post("/api/v1/parties").send(MEERA);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({ name: "Meera Textiles", city: "Surat" });
    });

    it("400s with VALIDATION_ERROR when the name is missing", async () => {
        const response = await request(app).post("/api/v1/parties").send({ city: "Surat" });

        expect(response.status).toBe(400);
        expect(response.body.error?.code ?? response.body.code).toBe("VALIDATION_ERROR");
    });

    it("409s with PARTY_NAME_EXISTS on a duplicate", async () => {
        await createMeera();

        const response = await request(app).post("/api/v1/parties").send(MEERA);

        expect(response.status).toBe(409);
        expect(response.body.error?.code ?? response.body.code).toBe("PARTY_NAME_EXISTS");
    });
});

describe("GET /api/v1/parties", () => {
    it("lists parties with meta", async () => {
        await createMeera();

        const response = await request(app).get("/api/v1/parties");

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.meta).toMatchObject({ page: 1, total: 1 });
    });

    it("filters by q", async () => {
        await createMeera();
        await request(app).post("/api/v1/parties").send({ name: "Rani Wholesale", city: "Rajkot" });

        const response = await request(app).get("/api/v1/parties?q=rajkot");

        expect(response.body.data.map((p) => p.name)).toEqual(["Rani Wholesale"]);
    });
});

describe("GET /api/v1/parties/:id", () => {
    it("returns one party", async () => {
        const created = await createMeera();

        const response = await request(app).get(`/api/v1/parties/${created.id}`);

        expect(response.status).toBe(200);
        expect(response.body.data.name).toBe("Meera Textiles");
    });

    it("404s with PARTY_NOT_FOUND", async () => {
        const response = await request(app).get("/api/v1/parties/999999");

        expect(response.status).toBe(404);
        expect(response.body.error?.code ?? response.body.code).toBe("PARTY_NOT_FOUND");
    });
});

describe("PUT /api/v1/parties/:id", () => {
    it("updates a party", async () => {
        const created = await createMeera();

        const response = await request(app).put(`/api/v1/parties/${created.id}`)
            .send({ ...MEERA, transport: "Gujarat Cargo Movers" });

        expect(response.status).toBe(200);
        expect(response.body.data.transport).toBe("Gujarat Cargo Movers");
    });
});

describe("PATCH /api/v1/parties/:id/status", () => {
    it("soft deletes a party", async () => {
        const created = await createMeera();

        const response = await request(app).patch(`/api/v1/parties/${created.id}/status`).send({ isActive: false });

        expect(response.status).toBe(200);
        expect(response.body.data.isActive).toBe(false);
    });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && pnpm test tests/sales/party.routes.test.js`
Expected: FAIL — cannot resolve `role.middleware.js` from the helper, or 404s on every route.

- [ ] **Step 3: Write the validators**

```js
import { z } from "zod";

const optionalText = (max) => z.string().trim().max(max).optional();

// Mobile and GST accept whatever the user types. The prototype's own sample data uses spaced
// mobiles ("98250 11210"), and a wholesaler copying a GST number off a card should never be
// blocked by a format rule that is wrong for some state or a foreign buyer.
const partyBodyShape = {
    name: z.string().trim().min(1, "Party name is required.").max(200),
    mobile: optionalText(20),
    city: optionalText(100),
    gst: optionalText(20),
    transport: optionalText(200),
    agent: optionalText(100),
};

export const createPartySchema = z.object(partyBodyShape);

export const updatePartySchema = z.object(partyBodyShape);

export const partyStatusSchema = z.object({ isActive: z.boolean() });

export const partyIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const listPartiesQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(200).default(50),
    q: z.string().trim().optional(),
    includeInactive: z.coerce.boolean().default(false),
});
```

- [ ] **Step 4: Write the controller**

```js
import { ApiResponse } from "../../../core/apiResponse.js";
import partyService from "../services/party.service.js";

class PartyController {
    _partyService = partyService;

    createParty = async (req, res, next) => {
        try {
            const result = await this._partyService.createParty(req.body);
            return res.status(201).json(new ApiResponse(201, result, "Party added to Party Master."));
        } catch (error) {
            next(error);
        }
    };

    updateParty = async (req, res, next) => {
        try {
            const result = await this._partyService.updateParty(req.params.id, req.body);
            return res.status(200).json(new ApiResponse(200, result, "Party updated."));
        } catch (error) {
            next(error);
        }
    };

    updateStatus = async (req, res, next) => {
        try {
            const result = await this._partyService.setStatus(req.params.id, req.body.isActive);
            return res.status(200).json(new ApiResponse(200, result, "Party status updated."));
        } catch (error) {
            next(error);
        }
    };

    getParty = async (req, res, next) => {
        try {
            const result = await this._partyService.getParty(req.params.id);
            return res.status(200).json(new ApiResponse(200, result, "Party fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    listParties = async (req, res, next) => {
        try {
            const response = await this._partyService.listParties(req.validatedQuery);
            return res.status(200).json(new ApiResponse(200, response.data, "Parties fetched successfully.", response.meta));
        } catch (error) {
            next(error);
        }
    };

    getSummary = async (req, res, next) => {
        try {
            const partyCount = await this._partyService.countParties();
            return res.status(200).json(new ApiResponse(200, { partyCount }, "Summary fetched successfully."));
        } catch (error) {
            next(error);
        }
    };
}

export default new PartyController();
```

- [ ] **Step 5: Write the route table**

```js
import partyController from "../controllers/party.controller.js";
import { validateRequest } from "../../../core/validateRequest.js";
import {
    createPartySchema,
    listPartiesQuerySchema,
    partyIdParamsSchema,
    partyStatusSchema,
    updatePartySchema,
} from "../validators/party.validator.js";

export const partyRoutes = [
    {
        path: "",
        controller: {
            get: partyController.listParties,
            post: partyController.createParty,
        },
        validators: {
            get: validateRequest(listPartiesQuerySchema, "query"),
            post: validateRequest(createPartySchema),
        },
    },
    // Declared before "/:id" so "summary" is never parsed as an id.
    {
        path: "/summary",
        controller: {
            get: partyController.getSummary,
        },
    },
    {
        path: "/:id",
        controller: {
            get: partyController.getParty,
            put: partyController.updateParty,
        },
        validators: {
            get: validateRequest(partyIdParamsSchema, "params"),
            put: validateRequest(partyIdParamsSchema, "params"),
        },
        middlewares: {
            put: [validateRequest(updatePartySchema)],
        },
    },
    {
        path: "/:id/status",
        controller: {
            patch: partyController.updateStatus,
        },
        validators: {
            patch: validateRequest(partyIdParamsSchema, "params"),
        },
        middlewares: {
            patch: [validateRequest(partyStatusSchema)],
        },
    },
];
```

Note on ordering: `buildRouter` registers routes in array order, so `/summary` must come before `/:id`. The `middlewares` + `validators` split for `put`/`patch` mirrors `orderForm.route.js` — body validation runs first, then params.

- [ ] **Step 6: Mount it and unmount the deleted modules**

In `backend/src/app/routes/index.js`, remove these imports and mounts:

```js
import { stockOutRoutes } from '../../modules/stock/routes/stockOut.route.js';
import { orderFormRoutes } from '../../modules/order/routes/orderForm.route.js';
```

```js
router.use('/stock-out', buildRouter(stockOutRoutes));
router.use('/order-forms', buildRouter(orderFormRoutes));
```

and add:

```js
import { partyRoutes } from '../../modules/sales/routes/party.route.js';
```

```js
router.use('/parties', buildRouter(partyRoutes));
```

- [ ] **Step 7: Run the tests**

Run: `cd backend && pnpm test tests/sales/party.routes.test.js`
Expected: 9 passing.

- [ ] **Step 8: Run the whole suite**

Run: `cd backend && pnpm test`
Expected: all suites green.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/sales backend/src/app/routes/index.js backend/tests/sales/party.routes.test.js
git commit -m "feat: expose party endpoints, unmount order-form and stock-out routes"
```

---

## Task 8: Delete the superseded backend code

**Files:**
- Delete: `backend/src/modules/order/` (15 files)
- Delete: 7 `stockOut*` files under `backend/src/modules/stock/`

- [ ] **Step 1: Delete the order module**

```bash
cd backend && rm -rf src/modules/order
```

- [ ] **Step 2: Delete the quantity-based stock-out path**

```bash
cd backend && rm -f \
  src/modules/stock/controllers/stockOut.controller.js \
  src/modules/stock/services/stockOut.service.js \
  src/modules/stock/services/stockOutCalculator.service.js \
  src/modules/stock/services/stockOutPersistence.service.js \
  src/modules/stock/services/stockOutValidator.service.js \
  src/modules/stock/validators/stockOut.validator.js \
  src/modules/stock/mapper/stockOutResultMapper.js \
  src/modules/stock/routes/stockOut.route.js
```

`stockOutTransaction.schema.js`, `stockOutEntry.schema.js` and their repositories stay — slice 3 writes to them.

- [ ] **Step 3: Verify nothing still imports the deleted files**

Run: `cd backend && grep -rn "modules/order\|stockOut\." src --include=*.js | grep -v "stockOutTransaction\|stockOutEntry"`
Expected: no output.

- [ ] **Step 4: Verify the server boots**

Run: `cd backend && node -e "import('./src/app.js').then(() => console.log('app loaded'))"`
Expected: prints `app loaded` with no module-resolution error.

- [ ] **Step 5: Run the suite**

Run: `cd backend && pnpm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add -A backend/src
git commit -m "refactor: remove order-form module and quantity-based stock-out path"
```

---

## Task 9: Role context and party API client

**Files:**
- Create: `frontend/src/features/sales/context/RoleContext.jsx`, `frontend/src/features/sales/services/party.api.js`, `frontend/src/features/sales/hooks/usePartiesApi.js`, `frontend/src/features/sales/hooks/usePartyMutations.js`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Create `RoleContext.jsx`**

```jsx
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ROLE_STORAGE_KEY = "stock-out-role";

const RoleContext = createContext(null);

function readStoredRole() {
    try {
        const stored = localStorage.getItem(ROLE_STORAGE_KEY);
        return stored === "owner" ? "owner" : "staff";
    } catch {
        // Private browsing and blocked site data both throw here. Staff is the safe default.
        return "staff";
    }
}

export const RoleProvider = ({ children }) => {
    const [role, setRoleState] = useState(readStoredRole);

    const setRole = useCallback((next) => {
        const value = next === "owner" ? "owner" : "staff";
        setRoleState(value);
        try {
            localStorage.setItem(ROLE_STORAGE_KEY, value);
        } catch {
            // Not being able to remember the choice is not worth failing the switch over.
        }
    }, []);

    const value = useMemo(() => ({ role, setRole, isOwner: role === "owner" }), [role, setRole]);

    return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const useRole = () => {
    const context = useContext(RoleContext);

    if (!context) throw new Error("useRole must be used within a RoleProvider");

    return context;
};

// Read outside React, for API modules that are plain functions rather than hooks. The header is a
// stand-in for real authentication; see role.middleware.js on the server.
export function currentRoleHeader() {
    return { "X-User-Role": readStoredRole() };
}
```

- [ ] **Step 2: Create `party.api.js`**

```js
import { currentRoleHeader } from "../context/RoleContext.jsx";

const baseURL = import.meta.env.VITE_API_BASE_URL;

async function request(path, options = {}) {
    const response = await fetch(`${baseURL}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...currentRoleHeader(),
            ...options.headers,
        },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        // The server's machine-readable code travels with the error so a caller can tell a
        // duplicate name (shown inline on the field) from anything else (shown as a toast).
        const error = new Error(data?.message ?? data?.error?.message ?? "Request failed.");
        error.code = data?.code ?? data?.error?.code;
        error.status = response.status;
        throw error;
    }

    return data;
}

export const getPartiesApi = ({ page = 1, limit = 50, q = "", includeInactive = false } = {}) => {
    const params = new URLSearchParams({ page, limit, includeInactive });
    if (q) params.set("q", q);

    return request(`/parties?${params.toString()}`);
};

export const getPartyApi = (id) => request(`/parties/${id}`);

export const getPartySummaryApi = () => request("/parties/summary");

export const createPartyApi = (payload) => request("/parties", { method: "POST", body: JSON.stringify(payload) });

export const updatePartyApi = (id, payload) => request(`/parties/${id}`, { method: "PUT", body: JSON.stringify(payload) });

export const updatePartyStatusApi = (id, isActive) =>
    request(`/parties/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) });
```

- [ ] **Step 3: Create `usePartiesApi.js`**

```js
import { useQuery } from "@tanstack/react-query";
import { getPartiesApi, getPartySummaryApi } from "../services/party.api.js";

export function usePartiesApi({ page = 1, limit = 50, q = "", includeInactive = false } = {}) {
    return useQuery({
        queryKey: ["parties", { page, limit, q, includeInactive }],
        queryFn: () => getPartiesApi({ page, limit, q, includeInactive }),
        placeholderData: (previous) => previous,
    });
}

export function usePartySummaryApi() {
    return useQuery({
        queryKey: ["parties", "summary"],
        queryFn: getPartySummaryApi,
    });
}
```

`placeholderData` keeps the previous page on screen while a new search runs, so the table does not blank out on every keystroke.

- [ ] **Step 4: Create `usePartyMutations.js`**

```js
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPartyApi, updatePartyApi, updatePartyStatusApi } from "../services/party.api.js";

function useInvalidateParties() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: ["parties"] });
}

export function useCreatePartyApi() {
    const invalidate = useInvalidateParties();

    return useMutation({
        mutationFn: createPartyApi,
        onSuccess: invalidate,
    });
}

export function useUpdatePartyApi() {
    const invalidate = useInvalidateParties();

    return useMutation({
        mutationFn: ({ id, payload }) => updatePartyApi(id, payload),
        onSuccess: invalidate,
    });
}

export function useUpdatePartyStatusApi() {
    const invalidate = useInvalidateParties();

    return useMutation({
        mutationFn: ({ id, isActive }) => updatePartyStatusApi(id, isActive),
        onSuccess: invalidate,
    });
}
```

- [ ] **Step 5: Wrap the app in `RoleProvider`**

In `frontend/src/main.jsx`, add the import and wrap `<App />`:

```jsx
import { RoleProvider } from "./features/sales/context/RoleContext.jsx";
```

```jsx
        <ModalProvider>
          <RoleProvider>
            <App />
          </RoleProvider>
        </ModalProvider>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/sales frontend/src/main.jsx
git commit -m "feat: add role context and party API client"
```

---

## Task 10: Stock Out shell

**Files:**
- Create: `frontend/src/features/sales/layouts/StockOutLayout.jsx`, `frontend/src/features/sales/pages/SlicePlaceholder.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/lib/getMenuList.js`

- [ ] **Step 1: Create `StockOutLayout.jsx`**

```jsx
import { NavLink, Outlet } from "react-router";
import { cn } from "@/lib/utils";
import { useRole } from "../context/RoleContext.jsx";

const TABS = [
    { to: "/stock-out", label: "Overview", end: true },
    { to: "/stock-out/orders", label: "Order Forms" },
    { to: "/stock-out/invoices", label: "Invoices" },
    { to: "/stock-out/parties", label: "Party Master" },
];

const StockOutLayout = () => {
    const { role, setRole } = useRole();

    return (
        <div className="flex h-[calc(100vh-8rem)] flex-col font-sans">
            <div className="mb-6 flex shrink-0 flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <nav className="flex gap-1 rounded-full p-1 toolbar-neu">
                    {TABS.map((tab) => (
                        <NavLink
                            key={tab.to}
                            to={tab.to}
                            end={tab.end}
                            className={({ isActive }) => cn(
                                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                                isActive ? "bg-[#1E1B4B] text-white" : "text-[#1E1B4B]/70 hover:text-[#1E1B4B]",
                            )}
                        >
                            {tab.label}
                        </NavLink>
                    ))}
                </nav>

                <label className="flex items-center gap-2 text-sm text-[#1E1B4B]/70">
                    Signed in as
                    <select
                        value={role}
                        onChange={(event) => setRole(event.target.value)}
                        className="rounded-full border border-white/40 bg-white/60 px-3 py-1.5 text-sm font-semibold text-[#1E1B4B] outline-none"
                        aria-label="Role"
                    >
                        <option value="staff">Staff</option>
                        <option value="owner">Owner</option>
                    </select>
                </label>
            </div>

            <div className="min-h-0 flex-1">
                <Outlet />
            </div>
        </div>
    );
};

export default StockOutLayout;
```

- [ ] **Step 2: Create `SlicePlaceholder.jsx`**

```jsx
import { Construction } from "lucide-react";

// Keeps the subnav honest between slices: the tab exists and explains itself rather than
// 404ing or pretending to be an empty list.
const SlicePlaceholder = ({ title, description }) => (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[24px] glass-card p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/60 text-[#1E1B4B]/60">
            <Construction className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-bold text-[#1E1B4B]">{title}</h2>
        <p className="max-w-[46ch] text-sm text-[#1E1B4B]/60">{description}</p>
    </div>
);

export default SlicePlaceholder;
```

- [ ] **Step 3: Rewire the routes**

In `frontend/src/App.jsx`, remove these imports:

```jsx
import StockOut from "./features/inventory/pages/StockOut";
import OrderForms from "./features/orderForms/pages/OrderForms";
import CreateOrderForm from "./features/orderForms/pages/CreateOrderForm";
import SharedOrderForm from "./features/orderForms/pages/SharedOrderForm";
```

and add:

```jsx
import StockOutLayout from "./features/sales/layouts/StockOutLayout";
import Overview from "./features/sales/pages/Overview";
import Parties from "./features/sales/pages/Parties";
import SlicePlaceholder from "./features/sales/pages/SlicePlaceholder";
```

Replace the `<Route path="/stock-out" ... />` line and all four `/order-forms*` routes with:

```jsx
          <Route path="/stock-out" element={<StockOutLayout />}>
            <Route index element={<Overview />} />
            <Route
              path="orders"
              element={<SlicePlaceholder
                title="Order Forms are coming in the next slice"
                description="The party master had to land first, because every order form is filled from it. Order Forms is the next piece of work."
              />}
            />
            <Route
              path="invoices"
              element={<SlicePlaceholder
                title="Invoices follow Order Forms"
                description="An invoice is built by scanning stock against an order form, so it depends on Order Forms being in place first."
              />}
            />
            <Route path="parties" element={<Parties />} />
          </Route>
```

Also delete the standalone `<Route path="/order-forms/share/:orderFormNumber" ... />` line outside `MainLayout`.

- [ ] **Step 4: Update the sidebar**

In `frontend/src/lib/getMenuList.js`, delete the whole `Sales` group object (the one containing the `/order-forms` entry) and its now-unused `FileText` import.

- [ ] **Step 5: Verify the build**

Run: `cd frontend && pnpm build`
Expected: succeeds. If it fails on a missing `features/orderForms` import, that import was missed in step 3.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.jsx frontend/src/lib/getMenuList.js frontend/src/features/sales
git commit -m "feat: add stock out shell with subnav and role switch"
```

---

## Task 11: Party Master screen

**Files:**
- Create: `frontend/src/features/sales/table/PartyColumns.jsx`, `frontend/src/features/sales/components/PartyFormDialog.jsx`, `frontend/src/features/sales/pages/Parties.jsx`

- [ ] **Step 1: Create `PartyColumns.jsx`**

```jsx
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export function buildPartyColumns({ onEdit }) {
    return [
        {
            accessorKey: "name",
            header: "Party",
            cell: ({ row }) => (
                <div>
                    <div className="font-semibold text-[#1E1B4B]">{row.original.name}</div>
                    {!row.original.isActive && (
                        <span className="text-xs font-semibold text-amber-700">Inactive</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "mobile",
            header: "Mobile",
            cell: ({ row }) => <span className="font-mono text-sm">{row.original.mobile || "—"}</span>,
        },
        { accessorKey: "city", header: "City", cell: ({ row }) => row.original.city || "—" },
        {
            accessorKey: "gst",
            header: "GST No.",
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.gst || "—"}</span>,
        },
        { accessorKey: "transport", header: "Transport", cell: ({ row }) => row.original.transport || "—" },
        { accessorKey: "agent", header: "Agent", cell: ({ row }) => row.original.agent || "—" },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div className="text-right">
                    <Button
                        variant="link"
                        className="neu-button rounded-full px-3 py-2 text-[#1E1B4B]"
                        onClick={() => onEdit(row.original)}
                    >
                        <Pencil className="mr-1 h-4 w-4" /> Edit
                    </Button>
                </div>
            ),
        },
    ];
}
```

Columns are built by a factory rather than exported as a constant because the edit cell needs the page's `onEdit` handler. `DesignsColumns.jsx` exports a constant; this differs deliberately, and the factory is the pattern to follow when a column needs a callback.

- [ ] **Step 2: Create `PartyFormDialog.jsx`**

```jsx
import { useState } from "react";
import { toast } from "react-toastify";
import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import { useCreatePartyApi, useUpdatePartyApi } from "../hooks/usePartyMutations.js";

const FIELDS = [
    { key: "name", label: "Party name", required: true },
    { key: "mobile", label: "Mobile" },
    { key: "city", label: "City" },
    { key: "gst", label: "GST No." },
    { key: "transport", label: "Transport" },
    { key: "agent", label: "Agent" },
];

const EMPTY = { name: "", mobile: "", city: "", gst: "", transport: "", agent: "" };

const PartyFormDialog = ({ open, setOpen, party }) => {
    const [form, setForm] = useState(party ? { ...EMPTY, ...party } : EMPTY);
    const [nameError, setNameError] = useState("");

    const createParty = useCreatePartyApi();
    const updateParty = useUpdatePartyApi();
    const isSaving = createParty.isPending || updateParty.isPending;

    const setField = (key) => (event) => {
        setForm((previous) => ({ ...previous, [key]: event.target.value }));
        if (key === "name") setNameError("");
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            setNameError("Party name is required.");
            return;
        }

        const payload = FIELDS.reduce((accumulator, field) => {
            accumulator[field.key] = form[field.key]?.trim() ?? "";
            return accumulator;
        }, {});

        try {
            if (party) await updateParty.mutateAsync({ id: party.id, payload });
            else await createParty.mutateAsync(payload);

            toast.success(party ? "Party updated." : `${payload.name} added to Party Master.`);
            setOpen(false);
        } catch (error) {
            // A duplicate name is the one error the user can fix in place, so it belongs on the
            // field rather than in a toast that disappears.
            if (error.code === "PARTY_NAME_EXISTS") setNameError(error.message);
            else toast.error(error.message);
        }
    };

    return (
        <ActionModal
            openActionModal={open}
            setOpenActionModal={setOpen}
            title={party ? "Edit party" : "Add party"}
            subtitle="Order forms and invoices fill from these details."
            showCloseButton
        >
            <div className="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-2">
                {FIELDS.map((field) => (
                    <div key={field.key} className={field.key === "name" ? "sm:col-span-2" : ""}>
                        <label className="mb-1.5 block text-xs font-semibold text-[#1E1B4B]" htmlFor={`party-${field.key}`}>
                            {field.label}
                            {field.required && <span className="text-red-600"> *</span>}
                        </label>
                        <input
                            id={`party-${field.key}`}
                            className="pill-input"
                            value={form[field.key] ?? ""}
                            onChange={setField(field.key)}
                            autoComplete="off"
                        />
                        {field.key === "name" && nameError && (
                            <p className="mt-1.5 text-xs font-medium text-red-600">{nameError}</p>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/40 px-6 py-4">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSaving}>Cancel</Button>
                <Button
                    className="rounded-full bg-[#00694C] px-5 text-white hover:bg-[#00563e]"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {party ? "Save party" : "Add party"}
                </Button>
            </div>
        </ActionModal>
    );
};

export default PartyFormDialog;
```

`ActionModal` takes `openActionModal` / `setOpenActionModal` (not `open` / `onOpenChange`) — the prop names above are already correct for it.

- [ ] **Step 3: Create `Parties.jsx`**

```jsx
import { useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import DataTable from "@/components/shared/table/DataTable";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePartiesApi } from "../hooks/usePartiesApi.js";
import { buildPartyColumns } from "../table/PartyColumns.jsx";
import PartyFormDialog from "../components/PartyFormDialog.jsx";

const Parties = () => {
    const [search, setSearch] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const debouncedSearch = useDebouncedValue(search, 300);
    const { data: response, isPending } = usePartiesApi({ page: 1, limit: 200, q: debouncedSearch });

    const parties = response?.data ?? [];
    const total = response?.meta?.total ?? 0;

    const openCreate = () => { setEditing(null); setDialogOpen(true); };
    const openEdit = (party) => { setEditing(party); setDialogOpen(true); };

    const columns = buildPartyColumns({ onEdit: openEdit });

    return (
        <div className="flex h-full flex-col">
            <div className="mb-4 flex shrink-0 flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-[#1E1B4B]">Party Master</h1>
                    <p className="mt-1 text-sm text-[#1E1B4B]/60">
                        Saved customers. Order forms and invoices fill from here.
                    </p>
                </div>
                <Button
                    variant="link"
                    className="neu-button rounded-full p-4 text-[#1E1B4B] transition-colors hover:!bg-[#00694C] hover:!text-white"
                    onClick={openCreate}
                >
                    <span className="flex items-center gap-1.5"><Plus className="h-5 w-5" /> Add party</span>
                </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col space-y-2 rounded-[24px] glass-table p-2">
                <div className="flex shrink-0 items-center justify-between gap-4 px-3 py-2.5">
                    <div className="relative flex w-full flex-1 items-center neu-pressed">
                        <Search className="absolute left-4 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by party name, mobile, city or GST no."
                            className="w-full border-none bg-transparent py-2 pl-12 pr-4 text-sm font-medium outline-none placeholder:text-gray-500"
                        />
                    </div>
                    <span className="shrink-0 text-xs text-[#1E1B4B]/50">{total} parties</span>
                </div>

                <div className="min-h-0 flex-1 bg-transparent">
                    {isPending ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="animate-spin text-[#00694C]" />
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={parties}
                            pageSize={12}
                            emptyState={{
                                title: search ? "No parties match" : "No parties yet",
                                description: search
                                    ? "Try a different name, mobile, city or GST number."
                                    : "Add your first party, or one will be created the first time you save an order form.",
                            }}
                        />
                    )}
                </div>
            </div>

            {dialogOpen && (
                <PartyFormDialog
                    key={editing?.id ?? "new"}
                    open={dialogOpen}
                    setOpen={setDialogOpen}
                    party={editing}
                />
            )}
        </div>
    );
};

export default Parties;
```

The `key` on the dialog forces a fresh mount per party, so its `useState` initial value is re-read instead of showing the previously edited party's details.

- [ ] **Step 4: Verify manually**

Run the backend (`cd backend && pnpm dev`) and the frontend (`cd frontend && pnpm dev`), then visit `/stock-out/parties`:
- Add a party — it appears in the table
- Add it again with the same name in different case — the name field shows "already exists in Party Master"
- Edit a party's transport — the change persists after a reload
- Type a city in the search box — the table filters

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/sales
git commit -m "feat: add party master screen"
```

---

## Task 12: Party autocomplete

**Files:**
- Create: `frontend/src/features/sales/components/PartyPicker.jsx`

Built now because it is the party module's own interface, and slices 2 and 3 both consume it unchanged. Nothing in slice 1 renders it.

- [ ] **Step 1: Create `PartyPicker.jsx`**

```jsx
import { useMemo, useRef, useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePartiesApi } from "../hooks/usePartiesApi.js";

const FIELDS = [
    { key: "name", label: "Party name", required: true, span: true },
    { key: "mobile", label: "Mobile" },
    { key: "city", label: "City" },
    { key: "gst", label: "GST No." },
    { key: "transport", label: "Transport" },
    { key: "agent", label: "Agent" },
];

const TRACKED = FIELDS.map((field) => field.key);

// Renders the six party fields with an autocomplete on the name. `value` is the full field set,
// `linkedParty` is the Party Master record it was filled from (null for a new party), and the
// parent owns both — so a document can save the fields it shows while deciding separately
// whether to write them back to Party Master.
const PartyPicker = ({ value, onChange, linkedParty, onLink }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const blurTimer = useRef(null);

    const debouncedQuery = useDebouncedValue(query, 250);
    const { data: response } = usePartiesApi({ page: 1, limit: 6, q: debouncedQuery });
    const matches = response?.data ?? [];

    const changedFields = useMemo(() => {
        if (!linkedParty) return [];
        return TRACKED.filter((key) => (linkedParty[key] ?? "") !== (value[key] ?? ""));
    }, [linkedParty, value]);

    const setField = (key) => (event) => {
        const next = { ...value, [key]: event.target.value };
        onChange(next);

        if (key === "name") {
            setQuery(event.target.value);
            setOpen(true);
            setHighlighted(-1);
            // Typing a different name means this is no longer the linked party.
            if (linkedParty && linkedParty.name.trim().toLowerCase() !== event.target.value.trim().toLowerCase()) {
                onLink(null);
            }
        }
    };

    const select = (party) => {
        onChange(TRACKED.reduce((accumulator, key) => ({ ...accumulator, [key]: party[key] ?? "" }), {}));
        onLink(party);
        setOpen(false);
        setHighlighted(-1);
    };

    const handleKeyDown = (event) => {
        if (!open || matches.length === 0) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlighted((index) => Math.min(index + 1, matches.length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted((index) => Math.max(index - 1, 0));
        } else if (event.key === "Enter" && highlighted >= 0) {
            event.preventDefault();
            select(matches[highlighted]);
        } else if (event.key === "Escape") {
            setOpen(false);
        }
    };

    const badge = (() => {
        if (!value.name?.trim()) return null;
        if (!linkedParty) {
            return { tone: "bg-blue-50 text-blue-700 border-blue-200", icon: Plus, text: "New party — will be added to Party Master" };
        }
        if (changedFields.length > 0) {
            return {
                tone: "bg-amber-50 text-amber-700 border-amber-200",
                icon: Pencil,
                text: `${changedFields.length} field${changedFields.length === 1 ? "" : "s"} changed from Party Master`,
            };
        }
        return { tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Check, text: "Filled from Party Master" };
    })();

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-bold text-[#1E1B4B]">Party details</h2>
                    <p className="text-xs text-[#1E1B4B]/60">
                        Pick a saved party to fill everything automatically — every field stays editable.
                    </p>
                </div>
                {badge && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.tone}`}>
                        <badge.icon className="h-3.5 w-3.5" /> {badge.text}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {FIELDS.map((field) => (
                    <div key={field.key} className={`relative ${field.span ? "sm:col-span-1" : ""}`}>
                        <label className="mb-1.5 block text-xs font-semibold text-[#1E1B4B]" htmlFor={`picker-${field.key}`}>
                            {field.label}
                            {field.required && <span className="text-red-600"> *</span>}
                        </label>
                        <input
                            id={`picker-${field.key}`}
                            className="pill-input"
                            autoComplete="off"
                            value={value[field.key] ?? ""}
                            onChange={setField(field.key)}
                            onKeyDown={field.key === "name" ? handleKeyDown : undefined}
                            onFocus={field.key === "name" ? () => { clearTimeout(blurTimer.current); setOpen(true); } : undefined}
                            onBlur={field.key === "name"
                                ? () => { blurTimer.current = setTimeout(() => setOpen(false), 120); }
                                : undefined}
                            placeholder={field.key === "name" ? "Start typing party name or mobile" : undefined}
                        />

                        {field.key === "name" && open && matches.length > 0 && (
                            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                                {matches.map((party, index) => (
                                    <button
                                        key={party.id}
                                        type="button"
                                        className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5 text-left last:border-b-0 ${index === highlighted ? "bg-emerald-50" : "hover:bg-emerald-50"}`}
                                        onMouseDown={(event) => { event.preventDefault(); select(party); }}
                                    >
                                        <span>
                                            <span className="block text-sm font-semibold text-[#1E1B4B]">{party.name}</span>
                                            <span className="block text-xs text-slate-500">
                                                {[party.city, party.mobile].filter(Boolean).join(" · ") || "No contact details"}
                                            </span>
                                        </span>
                                        <span className="font-mono text-xs text-slate-400">{party.gst}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const EMPTY_PARTY_FIELDS = { name: "", mobile: "", city: "", gst: "", transport: "", agent: "" };

export default PartyPicker;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && pnpm build`
Expected: succeeds. An "unused component" lint warning is expected and correct — slices 2–3 consume it.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/sales/components/PartyPicker.jsx
git commit -m "feat: add party autocomplete for order forms and invoices"
```

---

## Task 13: Overview screen

**Files:**
- Create: `frontend/src/features/sales/pages/Overview.jsx`

- [ ] **Step 1: Create `Overview.jsx`**

```jsx
import { useNavigate } from "react-router";
import { ArrowRight, FileText, Receipt, Users } from "lucide-react";
import { usePartySummaryApi } from "../hooks/usePartiesApi.js";

const STEPS = [
    "Customer shortlists at the counter",
    "Order Form (checklist)",
    "Pick & scan in the godown",
    "Invoice — stock deducted",
];

const ACTIONS = [
    {
        to: "/stock-out/orders",
        icon: FileText,
        tone: "bg-blue-50 text-blue-700",
        title: "New Order Form",
        description: "Scan the hanging designs the customer shortlists and note pieces per variant. Doesn't touch stock.",
    },
    {
        to: "/stock-out/invoices",
        icon: Receipt,
        tone: "bg-emerald-50 text-emerald-700",
        title: "New Invoice",
        description: "Fetch an order form as your checklist, scan the actual stock you pick, and bill it. Stock is deducted here.",
    },
];

const Overview = () => {
    const navigate = useNavigate();
    const { data: summary } = usePartySummaryApi();
    const partyCount = summary?.data?.partyCount;

    return (
        <div className="flex h-full flex-col gap-5 overflow-y-auto pb-2">
            <div className="rounded-[24px] glass-card p-6">
                <h1 className="text-3xl font-bold tracking-tight text-[#1E1B4B]">Stock Out</h1>
                <p className="mt-1 max-w-[72ch] text-sm text-[#1E1B4B]/60">
                    Note what the customer wants at the counter, then pick it from the godown and bill it — stock
                    updates only when the invoice is generated.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {ACTIONS.map((action) => (
                    <button
                        key={action.to}
                        type="button"
                        onClick={() => navigate(action.to)}
                        className="flex w-full items-start gap-4 rounded-[20px] glass-card p-5 text-left transition-shadow hover:shadow-lg"
                    >
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.tone}`}>
                            <action.icon className="h-5 w-5" />
                        </span>
                        <span>
                            <span className="block text-base font-bold text-[#1E1B4B]">{action.title}</span>
                            <span className="mt-0.5 block text-sm text-[#1E1B4B]/60">{action.description}</span>
                        </span>
                    </button>
                ))}
            </div>

            <div className="rounded-[24px] glass-card p-6">
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#1E1B4B]/60">
                    {STEPS.map((step, index) => (
                        <span key={step} className="flex items-center gap-2">
                            <span className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[11px] font-bold text-[#1E1B4B]">
                                    {index + 1}
                                </span>
                                {step}
                            </span>
                            {index < STEPS.length - 1 && <ArrowRight className="h-3.5 w-3.5" />}
                        </span>
                    ))}
                </div>

                <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/50 bg-white/40 px-5 py-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/70 text-[#1E1B4B]/70">
                        <Users className="h-5 w-5" />
                    </span>
                    <div>
                        <div className="font-mono text-xl font-bold text-[#1E1B4B]">
                            {partyCount ?? "—"}
                        </div>
                        <div className="text-xs text-[#1E1B4B]/60">Parties in Party Master</div>
                    </div>
                </div>

                <p className="mt-4 text-xs text-[#1E1B4B]/50">
                    Counts for open order forms, invoices this month, pieces dispatched and value invoiced arrive with
                    the Order Forms and Invoices slices.
                </p>
            </div>
        </div>
    );
};

export default Overview;
```

The deferred statistics are named rather than rendered as zeros. A tile reading "0 invoices this month" when the feature does not exist yet is a screen that lies.

- [ ] **Step 2: Verify manually**

Visit `/stock-out`: the party count matches Party Master, both action cards navigate to their placeholder panels, and the role switch persists across a reload.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/sales/pages/Overview.jsx
git commit -m "feat: add stock out overview"
```

---

## Task 14: Delete the superseded frontend code

**Files:**
- Delete: `frontend/src/features/orderForms/` (24 files), `frontend/src/features/inventory/pages/StockOut.jsx`, three stock-out client files

- [ ] **Step 1: Delete**

```bash
cd frontend && rm -rf src/features/orderForms \
  src/features/inventory/pages/StockOut.jsx \
  src/features/inventory/hooks/useStockOutRegisterApi.js \
  src/features/inventory/hooks/useVariantStockOutConfigs.js \
  src/features/inventory/services/stockOut.api.js
```

- [ ] **Step 2: Check for dangling imports**

Run: `cd frontend && grep -rn "orderForms\|StockOut\b\|stockOut\." src --include=*.jsx --include=*.js | grep -v "features/sales"`
Expected: no output. (`StockOutLayout` lives under `features/sales`, so it is excluded.)

- [ ] **Step 3: Verify the build and lint**

Run: `cd frontend && pnpm build && pnpm lint`
Expected: build succeeds; lint reports nothing new beyond pre-existing warnings.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src
git commit -m "refactor: remove old stock out page and order forms feature"
```

---

## Task 15: Full verification

- [ ] **Step 1: Backend suite**

Run: `cd backend && pnpm test`
Expected: every suite green. Record the counts.

- [ ] **Step 2: Frontend build**

Run: `cd frontend && pnpm build`
Expected: succeeds.

- [ ] **Step 3: Confirm the database state**

Run: `cd backend && psql "$DATABASE_URL" -c "\dt parties" -c "\dt legacy_order*"`
Expected: `parties` exists; three `legacy_order_*` tables exist; no `order_forms`.

- [ ] **Step 4: Walk the app**

With both servers running:
- `/stock-out` — overview renders, party count correct, both cards navigate
- `/stock-out/parties` — add, duplicate-rejected inline, edit, search
- `/stock-out/orders` and `/stock-out/invoices` — placeholder panels
- Sidebar has no Order Forms entry; Stock Out opens the shell
- Stock In, Current Stock, QR Center, Stock History, Design Master all still load

- [ ] **Step 5: Confirm against the definition of done**

Re-read the spec's "Definition of done" and check each line against what is running.

---

## Deferred to later slices

| Item | Slice |
|---|---|
| Order form tables, scan-to-add, quantity panel, print/CSV | 2 |
| The four document statistics and recent-document tables on Overview | 2 |
| Invoices, scan-to-pick, stock deduction, owner-only edit (`requireOwner`'s first real use) | 3 |
| Gallery: fetch by order/invoice/all, select, share, download, lightbox | 4 |
| Dropping the `legacy_order_*` tables | after 4, once trusted |
