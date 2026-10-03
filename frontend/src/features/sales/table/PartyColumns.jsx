import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

// Built by a factory rather than exported as a constant because the edit cell needs the page's
// handler. DesignsColumns.jsx exports a constant; this differs deliberately.
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
            accessorKey: "orderForms",
            header: "Orders",
            cell: ({ row }) => <span className="font-mono text-sm">{row.original.orderForms ?? 0}</span>,
        },
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
