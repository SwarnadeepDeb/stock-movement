# Stock Movement

A stock management system for a design-based inventory business (garments/textiles). It tracks designs and their color/size variants, registers inward stock with printable QR labels, records transformations between loose pieces, sets and bundles, and handles sales through parties, order forms and invoices.

## Features

- **Design master** – create and edit designs with color variants, sizes, semi-sets and image uploads (Cloudinary).
- **Stock In** – draft and register inward stock, with challans and per-variant serial counters.
- **QR Center** – generate A4 QR label sheets (PDF), scan QR codes, and print directly from the browser.
- **Stock transformations** – convert loose ↔ set ↔ bundle without altering the total physical piece count.
- **Current stock & history** – live inventory per design variant, manual adjustments, and a full movement history.
- **Sales** – parties, order forms, invoices, salesman tracking and a design gallery.
- **Local print agent** – a small service that sends label sheets to the printer attached to the local machine.

## Repository layout

| Directory | Description |
|-----------|-------------|
| [backend/](backend) | Express 5 REST API (Node.js, ESM), Drizzle ORM, PostgreSQL |
| [frontend/](frontend) | React 19 + Vite SPA, Tailwind CSS 4, TanStack Query/Table, Redux Toolkit |
| [print-agent/](print-agent) | Localhost service that prints QR label sheets (see its [README](print-agent/README.md)) |
| [docs/](docs) | Design specs and implementation plans |

## Tech stack

- **Backend:** Express, Drizzle ORM + drizzle-kit, PostgreSQL, better-auth, Zod, Pino, Helmet, Multer, Cloudinary, Vitest + Supertest
- **Frontend:** React, Vite, React Router, TanStack Query & Table, Redux Toolkit, react-hook-form, Tailwind CSS, shadcn/Base UI, jsPDF, qrcode, jsQR
- **Deployment:** Vercel (frontend and backend each have a `vercel.json`)

## Getting started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 10 (backend and frontend) and npm (print agent)
- A PostgreSQL database (local or hosted, e.g. Neon)
- A Cloudinary account for image uploads

### 1. Backend

```sh
cd backend
pnpm install
```

Create `backend/.env`:

```sh
NODE_ENV=development
PORT=8001
DATABASE_URL=postgresql://user:password@localhost:5432/stock_mngmt
DB_POOL_SIZE=10
LOG_LEVEL=info
SERVICE_NAME=stock-mgmt-backend

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

FRONTEND_URL=http://localhost:5173
```

Apply the SQL migrations in [backend/src/database/migrations](backend/src/database/migrations) to your database, then start the API:

```sh
pnpm dev
```

Environment variables are validated with Zod at startup; the server exits with a clear message if any are missing or invalid.

### 2. Frontend

```sh
cd frontend
pnpm install
```

Create `frontend/.env`:

```sh
VITE_API_BASE_URL=http://localhost:8001
```

```sh
pnpm dev
```

### 3. Print agent (optional)

Needed only if you want to print QR label sheets straight to a local printer. See [print-agent/README.md](print-agent/README.md).

## API overview

All routes are mounted in [backend/src/app/routes/index.js](backend/src/app/routes/index.js):

| Route prefix | Purpose |
|--------------|---------|
| `/designs` | Design master and variants |
| `/stock-in` | Inward stock entries and drafts |
| `/stock-items` | Individual stock items |
| `/qr-center` | QR batches and label sheets |
| `/stock-history` | Stock movement history |
| `/tag-presets` | Tag presets |
| `/current-stock` | Current inventory and adjustments |
| `/stock-transformations` | Loose / set / bundle conversions |
| `/parties` | Customers and suppliers |
| `/order-forms` | Sales order forms |
| `/invoices` | Invoices |
| `/sales` | Sales summaries |

## Inventory model

`variant_inventory.quantity` is the total physical pieces available for a color variant and design size.

- **Stock In** increments it and **Stock Out** decrements it.
- **Transformations** (loose → set, loose → bundle, set/bundle → unset/reset) preserve the total piece count, so they do not change it.
- Future adjustments and losses increment or decrement it as appropriate.

## Testing

```sh
cd backend
cp .env.test.example .env.test   # point TEST_DATABASE_URL at a disposable database
pnpm test
```

The suite truncates tables, so never point it at a database with real data. A local Postgres is strongly preferred over a remote one for speed.

## Scripts

| Location | Command | Description |
|----------|---------|-------------|
| backend | `pnpm dev` | Start the API with file watching and pretty logs |
| backend | `pnpm start` | Start the API |
| backend | `pnpm test` | Run the Vitest suite |
| frontend | `pnpm dev` | Start the Vite dev server |
| frontend | `pnpm build` | Production build |
| frontend | `pnpm lint` | Run ESLint |
| print-agent | `npm start` | Start the local print agent |
