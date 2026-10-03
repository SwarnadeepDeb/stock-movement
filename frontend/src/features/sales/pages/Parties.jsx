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
        <div className="flex flex-col">
            <div className="mb-4 flex shrink-0 flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-[#1E1B4B]">Party Master</h1>
                </div>
                <Button
                    variant="link"
                    className="neu-button rounded-full p-4 text-[#1E1B4B] transition-colors"
                    onClick={openCreate}
                >
                    <span className="flex items-center gap-1.5"><Plus className="h-5 w-5" /> Add party</span>
                </Button>
            </div>

            <div className="glass-table flex min-h-0 flex-1 flex-col space-y-2 rounded-[24px] p-2">
                <div className="flex shrink-0 items-center justify-between gap-4 px-3 py-2.5">
                    <div className="neu-pressed relative flex w-full flex-1 items-center">
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
                        <div className="flex items-center justify-center py-16">
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
