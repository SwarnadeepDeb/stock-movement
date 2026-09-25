import { useState } from "react";
import { useSearchParams } from "react-router";

import QrCenterHeader from "../components/qrCenter2/QrCenterHeader.jsx";
import { Sheet } from "../components/qrCenter2/shared/primitives.jsx";
import SearchBar from "../components/qrCenter2/search/SearchBar.jsx";
import FilterBar from "../components/qrCenter2/search/FilterBar.jsx";
import ResultList from "../components/qrCenter2/search/ResultList.jsx";
import TagDetail from "../components/qrCenter2/search/TagDetail.jsx";
import HistorySection from "../components/qrCenter2/history/HistorySection.jsx";
import ReprintDrawer from "../components/qrCenter2/drawer/ReprintDrawer.jsx";
import BatchStudioDrawer from "../components/qrCenter2/drawer/BatchStudioDrawer.jsx";
import { useQrCenterSearchApi } from "../hooks/useQrCenterSearchApi.js";
import { useQrCenterResolveApi } from "../hooks/useQrCenterResolveApi.js";
import { useDesignListApi } from "../../design/hooks/useDesignListApi.js";

const EMPTY_FILTERS = { designId: "", colorVariantId: "", type: "", days: "" };

const QrCenter = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    // Set by "View QR tags" on a Stock In challan: narrows the history below to that challan.
    const challanNo = searchParams.get("challan") ?? "";
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [selectedCode, setSelectedCode] = useState(null);
    const [reprintTargets, setReprintTargets] = useState(null);
    // The Configure & print studio. `session` changes on every open so the studio starts clean.
    const [studio, setStudio] = useState({ open: false, batchId: null, session: 0 });

    const { data: designsResponse } = useDesignListApi({ limit: 100 });
    const designs = designsResponse?.data ?? [];

    const hasQuery = Boolean(query || filters.designId || filters.colorVariantId || filters.type || filters.days);
    const { data: searchResponse, isFetching } = useQrCenterSearchApi(
        { keyword: query, ...filters, limit: 30 },
        { enabled: hasQuery && !selectedCode },
    );
    const { data: resolveResponse } = useQrCenterResolveApi(selectedCode);

    const handleSelectResult = (code) => setSelectedCode(code);
    const handleBackFromDetail = (nextCode) => setSelectedCode(nextCode ?? null);

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3.5 pb-10 text-sm text-slate-900 sm:gap-5 sm:pb-16">
            <QrCenterHeader />

            <Sheet>
                <SearchBar
                    value={query}
                    onChange={(v) => { setQuery(v); setSelectedCode(null); }}
                    placeholder="Search by set ID, piece ID, design code or challan no."
                />
                <FilterBar
                    designs={designs}
                    filters={filters}
                    onChange={(f) => { setFilters(f); setSelectedCode(null); }}
                    onClear={() => setFilters(EMPTY_FILTERS)}
                    resultCount={searchResponse?.meta?.total ?? 0}
                    showCount={hasQuery && !selectedCode}
                    searchKeyword={query}
                />

                {selectedCode ? (
                    <TagDetail
                        result={resolveResponse?.data}
                        onBack={handleBackFromDetail}
                        onRaiseReprint={(targets) => setReprintTargets(targets)}
                    />
                ) : (
                    <ResultList
                        tags={searchResponse?.data ?? []}
                        onSelect={handleSelectResult}
                        loading={isFetching}
                        hasQuery={hasQuery}
                    />
                )}
            </Sheet>

            <HistorySection
                designs={designs}
                challanNo={challanNo}
                onClearChallan={() => setSearchParams({}, { replace: true })}
                onOpen={(row) => setStudio((prev) => ({ open: true, batchId: row.batchId, session: prev.session + 1 }))}
            />

            <ReprintDrawer
                open={Boolean(reprintTargets)}
                onClose={() => setReprintTargets(null)}
                targets={reprintTargets}
                onDone={() => setSelectedCode(null)}
            />
            <BatchStudioDrawer
                open={studio.open}
                batchId={studio.batchId}
                sessionKey={studio.session}
                onClose={() => setStudio((prev) => ({ ...prev, open: false }))}
            />
        </div>
    );
};

export default QrCenter;
