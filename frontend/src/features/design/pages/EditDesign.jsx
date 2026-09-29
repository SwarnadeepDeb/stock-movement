import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";

import DesignWizard from "../components/DesignWizard";
import { useDesignDetailApi } from "../hooks/useDesignDetailApi";

// Wizard form values for an existing design — same field names the register wizard uses.
function toFormValues(design) {
  return {
    itemNameId: design.itemNameId ?? null,
    itemName: design.itemName ?? "",
    code: design.code ?? "",
    patternId: design.patternId ?? null,
    name: design.name ?? "",
    jobberId: design.jobberId ?? null,
    jobberName: design.jobberName ?? "",
    qualityId: design.qualityId ?? null,
    quality: design.quality ?? "",
    defaultSellingPricePerPiece: design.defaultSellingPricePerPiece ?? "",
    notes: design.notes ?? "",
    sizes: design.sizes.map((size) => size.sizeLabel),
    semiSets: design.semiSets.map((semiSet) => ({ label: semiSet.label, sizeLabels: semiSet.sizeLabels })),
    colorVariants: design.colorVariants.map((variant) => ({
      id: variant.id,
      colorName: variant.colorName,
      colorHex: variant.colorHex.toUpperCase(),
      imagePreview: variant.imageUrl,
      imageFile: null,
      piecesInStock: variant.piecesInStock,
    })),
  };
}

const EditDesign = () => {
  const { id } = useParams();
  const { data, isLoading, isError, error } = useDesignDetailApi(id);
  const design = data?.data;
  const initialValues = useMemo(() => (design ? toFormValues(design) : null), [design]);

  return (
    <section className="mx-auto w-full max-w-[1300px]">
      <Link to="/designs" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-3.5" /> Design Master
      </Link>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-[#1E1B4B]">Edit Design</h1>
        {design && (
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono font-semibold">{design.code}</span> · {design.itemName || design.name}
          </p>
        )}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading design…
        </div>
      ) : isError ? (
        <p className="py-16 text-sm text-red-600">{error.message}</p>
      ) : (
        <div className="rounded-[24px] px-3">
          {/* keyed so a refetch of a different design re-seeds the form */}
          <DesignWizard key={design.id} editDesign={design} initialValues={initialValues} />
        </div>
      )}
    </section>
  );
};

export default EditDesign;
