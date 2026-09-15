import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flexRender } from "@tanstack/react-table";
import {
    getCoreRowModel,
    getPaginationRowModel,
    useLegacyTable,
} from "@tanstack/react-table/legacy";
import DataTableEmpty from "./DataTableEmpty";

// rowSelection/onRowSelectionChange/getRowId are optional and only take effect when a
// caller supplies them (e.g. QrCenter's bulk-select column) — omitting them keeps every
// existing DataTable usage (CurrentStock, CurrentStockDetail) exactly as it was.
const DataTable = ({ columns, data, emptyState, pageSize = 10, rowSelection, onRowSelectionChange, getRowId }) => {
    const table = useLegacyTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize } },
        ...(rowSelection !== undefined && {
            enableRowSelection: true,
            state: { rowSelection },
            onRowSelectionChange,
            getRowId,
        }),
    })

    return (
        <div className="h-full overflow-auto rounded-3xl border border-white/40 bg-white/20 backdrop-blur-xl [scrollbar-width:thin] [scrollbar-color:rgba(30,27,75,0.25)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#1E1B4B]/25 [&::-webkit-scrollbar-thumb:hover]:bg-[#1E1B4B]/40">
            <Table className="border-separate border-spacing-y-2">
                <TableHeader className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="border-0 hover:bg-transparent">
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id} className="px-6 py-5 text-sm font-semibold text-[#1E1B4B]">
                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>

                <TableBody>
                    {table.getRowModel().rows.length ? (table.getRowModel().rows.map((row) => (
                        <TableRow
                            key={row.id}
                            className="border-0 bg-white/70 transition-all duration-200 hover:bg-white"
                        >
                            {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id} className="px-6 py-5">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))
                    ) : (
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={columns.length} className="h-24">
                                <DataTableEmpty title={emptyState?.title} description={emptyState?.description} />
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}

export default DataTable
