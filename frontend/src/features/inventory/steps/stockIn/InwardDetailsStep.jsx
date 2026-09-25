import { useMemo } from "react";
import { FileCheck, Loader2Icon, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import DesignSearchInput from "../../components/DesignSearchInput";
import JobberSelect from "../../components/stock-in/JobberSelect";
import { useColorVariantSizesApi } from "../../hooks/useColorVariantSizesApi";
import { getVariantKey } from "../../utils/variantKey";

const JWO_INPUT_CLASSNAME =
  "h-[42px] rounded-lg border-slate-200 bg-white focus-within:border-emerald-500 focus-within:ring-[3px] focus-within:ring-emerald-500/10 **:data-[slot=input-group-control]:pl-9 **:data-[slot=input-group-control]:text-sm";

const inputClassName = (hasError) =>
  cn(
    "h-[42px] rounded-lg border-slate-200 bg-white text-sm focus-visible:border-emerald-500 focus-visible:ring-emerald-500/10",
    hasError && "border-red-500 ring-[3px] ring-red-500/10",
  );

const formatInr = (amount) => `₹ ${Number(amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const Field = ({ label, htmlFor, error, children }) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold text-slate-800" htmlFor={htmlFor}>
      {label}
      <span className="ml-0.5 text-red-600">*</span>
    </label>
    {children}
    <div className="mt-1 min-h-4 text-[11.5px] text-red-600">{error}</div>
  </div>
);

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// One card per design on the challan — identity read from the design's first selected variant.
const DesignIdentityCard = ({ variants, onRemoveDesign }) => {
  const primary = variants[0];
  const { data: sizesResponse, isFetching } = useColorVariantSizesApi({ colorVariantId: primary.colorVariantId });
  const sizes = sizesResponse?.data ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <b className="break-all text-sm text-slate-900">{primary.designCode ?? primary.designName}</b>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            {isFetching ? (
              <span className="inline-flex items-center gap-1.5"><Loader2Icon className="size-3 animate-spin" /> Loading...</span>
            ) : (
              `${sizes.length}-Piece Set Design`
            )}
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            {variants.map((variant) => (
              <span key={getVariantKey(variant)} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: variant.colorHex }} />
                {variant.colorName}
              </span>
            ))}
          </span>
        </div>
        <button type="button" onClick={() => onRemoveDesign(variants)} className="shrink-0 py-1 text-xs font-medium text-red-600 hover:underline">
          Remove<span className="hidden sm:inline"> design</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 break-words text-xs sm:grid-cols-4 sm:gap-4">
        <div>
          <span className="block text-slate-500">Design Code</span>
          <span className="text-sm font-bold text-slate-800">{primary.designCode ?? "—"}</span>
        </div>
        <div>
          <span className="block text-slate-500">Garment Pattern</span>
          <span className="font-semibold text-slate-800">{primary.designName ?? "—"}</span>
        </div>
        <div>
          <span className="block text-slate-500">Fabric Quality</span>
          <span className="font-semibold text-slate-800">{primary.designQuality ?? "—"}</span>
        </div>
        <div>
          <span className="block text-slate-500">Selling Price / Pc</span>
          <span className="text-sm font-bold text-emerald-700">{formatInr(primary.sellingPricePerPiece)} / Pc</span>
        </div>
      </div>
    </div>
  );
};

const InwardDetailsStep = ({
  jobber,
  onJobberChange,
  challanNo,
  onChallanNoChange,
  issuedChallanNo,
  onIssuedChallanNoChange,
  challanDate,
  onChallanDateChange,
  nextSerial,
  selectedVariants,
  onAddVariant,
  onRemoveVariant,
  errors,
}) => {
  const designs = useMemo(() => {
    const groups = new Map();
    for (const variant of selectedVariants) {
      groups.set(variant.designId, [...(groups.get(variant.designId) ?? []), variant]);
    }
    return [...groups.values()];
  }, [selectedVariants]);

  const removeDesign = (variants) => variants.forEach(onRemoveVariant);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-x-5 gap-y-1 md:grid-cols-2">
        <Field label="Jobber Name" htmlFor="jobberSelect" error={errors.jobber}>
          <JobberSelect id="jobberSelect" value={jobber?.name} onChange={onJobberChange} />
        </Field>

        <Field label="Design id" htmlFor="design-search" error={errors.design}>
          <div className="relative">
            <FileCheck className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
            <DesignSearchInput
              id="design-search"
              placeholder="Search by design code or name... (add as many as the challan has)"
              onSelect={onAddVariant}
              inputClassName={JWO_INPUT_CLASSNAME}
            />
          </div>
        </Field>

        <Field label="Jobber Delivery Challan No." htmlFor="challanNo" error={errors.challanNo}>
          <Input
            id="challanNo"
            autoComplete="off"
            placeholder="e.g. DC-2026/9021"
            value={challanNo}
            onChange={(event) => onChallanNoChange(event.target.value)}
            className={inputClassName(errors.challanNo)}
          />
        </Field>

        <Field label="Issued Challan Number" htmlFor="issuedChallanNo" error={errors.issuedChallanNo}>
          <Input
            id="issuedChallanNo"
            autoComplete="off"
            placeholder="Our challan for this job work, e.g. SF/ISS/0430"
            value={issuedChallanNo}
            onChange={(event) => onIssuedChallanNoChange(event.target.value)}
            className={inputClassName(errors.issuedChallanNo)}
          />
        </Field>

        <Field label="Challan / Inward Date" htmlFor="challanDate" error={errors.challanDate}>
          <Input
            id="challanDate"
            type="date"
            max={todayIso()}
            value={challanDate}
            onChange={(event) => onChallanDateChange(event.target.value)}
            className={inputClassName(errors.challanDate)}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-800">Serial No.</span>
          <div className="flex h-[42px] items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3">
            <b className="font-mono text-[15px] text-slate-900">{nextSerial ?? "…"}</b>
          </div>
        </div>
      </div>

      {selectedVariants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedVariants.map((variant) => (
            <span
              key={getVariantKey(variant)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pr-1.5 pl-2.5 text-xs font-medium text-slate-700"
            >
              <span className="size-2.5 rounded-full" style={{ backgroundColor: variant.colorHex }} />
              {variant.designCode ? `${variant.designCode} · ` : ""}
              {variant.colorName}
              <button
                type="button"
                onClick={() => onRemoveVariant(variant)}
                className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={`Remove ${variant.colorName}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Auto-Fetched Design Identity</span>
          <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            {designs.length
              ? `${designs.length} design${designs.length > 1 ? "s" : ""} · ${selectedVariants.length} variant${selectedVariants.length === 1 ? "" : "s"}`
              : "No designs yet"}
          </span>
        </div>
        {designs.length ? (
          <div className="space-y-3 sm:max-h-[330px] sm:overflow-y-auto sm:pr-1">
            {designs.map((variants) => (
              <DesignIdentityCard key={variants[0].designId} variants={variants} onRemoveDesign={removeDesign} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-[1.5px] border-dashed border-slate-300 p-4 text-center sm:p-5 text-[12.5px] text-slate-500">
            Search a design code above — every design on this challan gets its own card here.
          </div>
        )}
      </div>
    </div>
  );
};

export default InwardDetailsStep;
