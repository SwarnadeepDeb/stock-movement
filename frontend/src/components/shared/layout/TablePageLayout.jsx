import { cn } from "@/lib/utils";

// MainLayout's content area (the div wrapping <Outlet/>) is itself height-bounded —
// flex-1/min-h-0 inside `main`'s h-screen — but a plain block child of it defaults to
// height:auto and just grows with its content, so DataTable's own `h-full` (see
// components/shared/table/DataTable.jsx) never has anything definite to resolve against.
// This gives a list/table page that same bounded height so its DataTable can scroll
// internally — rows scroll, header/filters/pagination stay put — instead of the whole
// page growing with row count.
//
// Only pages with a potentially-large table should use this. A page whose table is
// naturally small (e.g. CurrentStockDetail's per-size breakdown) should NOT — an
// unbounded (height:auto) ancestor is exactly what lets that table size to its content
// instead of being forced into an oversized scroll box.
const TablePageLayout = ({ className, children }) => (
  <div className={cn("flex h-[calc(100vh-8rem)] h-[calc(100dvh-8rem)] flex-col font-sans", className)}>{children}</div>
);

export default TablePageLayout;
