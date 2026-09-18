// Pure data/calc layer for the QR Tag Studio step. Every count here is derived from the
// real Step 2 (Set Matrix) + Step 3 (QC & Defect) wizard state passed in — nothing here
// invents its own numbers. See QrTagStudioStep.jsx for how the inputs are assembled.

export const PRINTERS = [
  "TSC TE244 Thermal Roll (50x30mm) [Bluetooth]",
  "TVS LP 46 Neo Barcode Printer [USB]",
  "A4 Laser Printer (4×10 · 40-Up)",
];

export const THERMAL_PRESETS = {
  "50x30": { w: 50, h: 30, k: "STANDARD DUAL", d: "Dual parent / child tag" },
  "50x25": { w: 50, h: 25, k: "COMPACT", d: "Collar hangtag" },
  "40x25": { w: 40, h: 25, k: "MICRO", d: "Piece poly sticker" },
};

export const A4_PRESETS = {
  40: { c: 4, r: 10, w: 52.5, h: 29.7, k: "40-UP" },
};

// Field toggle definitions per tag kind. Every `ex` (example) below is filled at render time
// from real workflow data — nothing here is a hardcoded display value. Fields with no honest
// data source in this app's data model (e.g. a garment measurement chart) are simply not
// offered, rather than shown with a fabricated placeholder.
export const FIELD_DEFS = {
  parent: [
    { k: "firm", n: "Firm name header", on: true },
    { k: "design", n: "Design code", on: true, lock: true },
    { k: "dname", n: "Pattern name", on: true },
    { k: "variant", n: "Variant", on: true, lock: true },
    { k: "comp", n: "Size composition", on: true },
    { k: "setid", n: "Set ID", on: true, lock: true },
    { k: "price", n: "Selling price (per piece)", on: true },
    { k: "jobber", n: "Jobber name", on: false },
    { k: "date", n: "Inward date (FIFO clock)", on: true },
  ],
  child: [
    { k: "firm", n: "Firm name header", on: true },
    { k: "design", n: "Design code", on: true, lock: true },
    { k: "dname", n: "Pattern name", on: true },
    { k: "variant", n: "Variant", on: true, lock: true },
    { k: "size", n: "Size", on: true, lock: true },
    { k: "parent", n: "Parent set ID link", on: true },
    { k: "pid", n: "Piece ID", on: true, lock: true },
    { k: "price", n: "Selling price (per piece)", on: true },
    { k: "jobber", n: "Jobber name", on: false },
  ],
  loose: [
    { k: "firm", n: "Firm name header", on: true },
    { k: "design", n: "Design code", on: true, lock: true },
    { k: "dname", n: "Pattern name", on: false },
    { k: "variant", n: "Variant", on: true, lock: true },
    { k: "size", n: "Size", on: true, lock: true },
    { k: "origin", n: "Origin badge", on: true },
    { k: "pid", n: "Piece ID", on: true, lock: true },
    { k: "price", n: "Selling price (per piece)", on: true },
    { k: "date", n: "Loose-since date", on: true },
  ],
};

export const defaultFieldState = () => {
  const state = {};
  for (const tab of Object.keys(FIELD_DEFS)) {
    state[tab] = {};
    for (const field of FIELD_DEFS[tab]) state[tab][field.k] = field.on;
  }
  return state;
};

// One row of the Generation Queue table for a single variant.
// `sets`/`semiSets`/`loose` come straight from Step 2; `qcPassed` from Step 3. Every SET and
// every semi-set BUNDLE gets its own parent tag (see the mock's own countFor: `p += sets +
// semi`), so `parentTags` is the two combined — never just `sets` alone. Child tags only
// exist when the chosen strategy actually breaks sets into pieces at inward; loose pieces
// always get their own tag (they were never inside a sealed set to begin with). `child` is
// QC-passed minus loose, clamped at 0, so Parent+Child+Loose never double-counts a garment
// against the real QC-approved total.
// Strategy is "parentChild" (sets/semi sets AND their pieces are tagged), "none" (their labels
// are left for QR Center — the codes are still issued at registration) or the legacy "parent" /
// "custom". Loose pieces are an independent switch: perVariantSettings[key].tagLoosePieces.
export const parentTagsActive = (strategy) => strategy !== "none";

export function computeVariantRow(variant, strategy, perVariantSettings) {
  const settings = perVariantSettings[variant.key] ?? { included: true, childTags: false, tagLoosePieces: true };
  const included = settings.included !== false;
  const childActive = strategy === "parentChild" || (strategy === "custom" && settings.childTags);

  const sets = included ? variant.setsTotal : 0;
  const semiSets = included ? (variant.semiSetsTotal || 0) : 0;
  const loose = included && settings.tagLoosePieces !== false ? variant.looseTotal : 0;
  const child = included && childActive ? Math.max(0, variant.qcPassed - variant.looseTotal) : 0;
  const parentTags = parentTagsActive(strategy) ? sets + semiSets : 0;
  const total = parentTags + child + loose;

  return { key: variant.key, variant, included, childActive, sets, semiSets, parentTags, loose, child, total };
}

export function aggregateRows(rows) {
  return rows.reduce(
    (acc, row) => ({
      sets: acc.sets + row.sets,
      semiSets: acc.semiSets + row.semiSets,
      loose: acc.loose + row.loose,
      parent: acc.parent + row.parentTags,
      child: acc.child + row.child,
      total: acc.total + row.total,
    }),
    { sets: 0, semiSets: 0, loose: 0, parent: 0, child: 0, total: 0 }
  );
}

// Preview totals for a strategy card — "if this strategy were chosen", independent of which
// one is actually active right now.
export function strategyPreview(variants, strategyKey, perVariantSettings) {
  const rows = variants.map((v) => computeVariantRow(v, strategyKey, perVariantSettings));
  const agg = aggregateRows(rows);
  const applyMinutes = Math.round((agg.parent * 4 + agg.child * 7 + agg.loose * 7) / 60);
  return { total: agg.total, applyMinutes };
}

export function labelDims(engine, thermalPreset, a4Preset) {
  return engine === "thermal" ? THERMAL_PRESETS[thermalPreset] : A4_PRESETS[a4Preset];
}

export function fieldCapacity(engine, thermalPreset, a4Preset, typography) {
  const perLine = { compact: 3.0, standard: 3.7, large: 4.6 }[typography];
  const h = labelDims(engine, thermalPreset, a4Preset).h;
  return Math.max(3, Math.floor((h - 4) / perLine) + 2);
}

// Narrates which variants actually had QC defects, using the real per-variant defect counts
// and the chosen defect-handling action from Step 3 — never a canned example sentence.
export function buildDefectNarrative(variants, defectAction) {
  const withDefects = variants.filter((v) => v.qcDefects > 0);
  if (withDefects.length === 0) {
    return "No QC defects logged for this batch — every count below matches the Set Matrix quantities exactly.";
  }
  const clauses = withDefects.map((v) => {
    const action = defectAction === "return" ? "returned to the jobber" : "moved to factory seconds";
    return `${v.qcDefects} defective ${v.colorName} pcs were ${action}`;
  });
  return `Read live from the post-QC results — not from what the challan said. ${clauses.join("; ")}.`;
}

// True when a BUNDLE's own composition has fewer sizes than the variant's full set — the
// only signal this data model has for "semi set" (semi sets are not a distinct backend
// concept: they are a BUNDLE stock item like any other).
export function isSemiSet(bundleSizeCount, fullSetSizeCount) {
  return bundleSizeCount > 0 && bundleSizeCount < fullSetSizeCount;
}

// Expands the aggregate per-variant totals + live configs into one entry per physical tag
// that will actually be printed — parent (SET/semi-set BUNDLE), child (PIECE), and loose.
// This mirrors exactly what the backend creates at Stock-In confirm time (see
// stockPieceExpansion.service.js on the backend): one child PIECE per composition entry for
// every SET/BUNDLE, unconditioned on QC — so on a batch with defects this total can differ
// slightly from computeVariantRow's QC-adjusted "child" count used in the Generation Queue
// table. That's intentional: the queue table answers "how many sellable pieces do we expect
// after QC"; this list answers "what will physically be created and printed for the
// sets/bundles registered."
//
// Serial numbers: every colour variant keeps two running counters on the backend (see
// variant_serial_counters) — one for sets/semi sets, one for pieces (child + loose together).
// `serialStarts[colorVariantId]` is the next free number of each; a new inward continues from
// there instead of restarting at 1. The backend numbers EVERY registered unit in the order
// below (sets, then semi sets; pieces in set, semi-set, loose order) whether or not its label is
// printed, so unprinted units still consume a number here to keep the two sides in step.
export function buildTagList(variants, configs, strategy, perVariantSettings, serialStarts = {}) {
  const tags = [];
  let seq = 0;

  for (const variant of variants) {
    const settings = perVariantSettings[variant.key] ?? { included: true, childTags: false, tagLoosePieces: true };
    const included = settings.included !== false;

    const config = configs[variant.key];
    const sizes = variant.sizes ?? [];
    const fullSetSizes = sizes.filter((size) => size.includedInSet);
    const childActive = strategy === "parentChild" || (strategy === "custom" && settings.childTags);
    const parentPrinted = included && parentTagsActive(strategy);
    const tagLoose = settings.tagLoosePieces !== false;

    let nextSet = serialStarts[variant.colorVariantId]?.set ?? 1;
    let nextPiece = serialStarts[variant.colorVariantId]?.piece ?? 1;
    const pieceTag = (base) => {
      const serial = nextPiece++;
      if (included && base.printed) tags.push({ id: ++seq, serial, ...base });
    };

    const addParent = (isSemi, composition, quantityOfEach) => {
      for (let i = 0; i < quantityOfEach; i++) {
        const serial = nextSet++;
        const parentId = `${isSemi ? "SEMI" : "SET"}-${variant.code}-${padSerial(serial, 3)}`;
        if (parentPrinted) {
          tags.push({
            id: ++seq, kind: "parent", isSemiSet: isSemi, code: parentId, serial, variant,
            composition: composition.map((c) => c.sizeLabel), piecesPerSet: composition.length,
          });
        }
        if (childActive) {
          composition.forEach((piece) => {
            for (let q = 0; q < piece.qty; q++) {
              pieceTag({
                printed: true, kind: "child", variant, size: piece.sizeLabel, parentId,
                code: `${variant.code}-${padSerial(nextPiece, 4)}`,
              });
            }
          });
        }
      }
    };

    // SETs — one piece per full-set size.
    addParent(false, fullSetSizes.map((size) => ({ sizeLabel: size.sizeLabel, qty: 1 })), variant.setsTotal);

    // Semi sets / bundles
    (config?.bundles ?? []).forEach((bundle) => {
      const compEntries = Object.entries(bundle.composition ?? {}).filter(([, qty]) => Number(qty) > 0);
      if (compEntries.length === 0 || !(bundle.quantity > 0)) return;
      const composition = compEntries
        .map(([sizeId, qty]) => ({ sizeLabel: sizes.find((s) => String(s.id) === String(sizeId))?.sizeLabel, qty: Number(qty) }))
        .filter((piece) => piece.sizeLabel);
      const semi = isSemiSet(composition.length, fullSetSizes.length);
      addParent(semi, composition, bundle.quantity);
    });

    // Loose pieces — always their own tag when tagged; untagged loose stock has no physical
    // tag at all (matches the backend leaving it as a fungible LOOSE_PIECE with no QR).
    if (tagLoose) {
      Object.entries(config?.loosePieces ?? {}).forEach(([sizeId, qty]) => {
        const sizeLabel = sizes.find((s) => String(s.id) === String(sizeId))?.sizeLabel ?? "";
        for (let i = 0; i < Number(qty || 0); i++) {
          pieceTag({ printed: true, kind: "loose", variant, size: sizeLabel, code: `LSE-${variant.code}-${padSerial(nextPiece, 4)}` });
        }
      });
    }
  }

  return tags;
}

const padSerial = (serial, width) => String(serial).padStart(width, "0");

// Real per-tag issues only — no fabricated examples.
export function flagsForTag(engine, thermalPreset, a4Preset, typography, qrmm, fieldsOnCount) {
  const flags = [];
  if (qrmm < 12) flags.push({ level: "bad", text: `QR ${qrmm} mm — will fail on creased poly` });
  else if (qrmm < 15) flags.push({ level: "warn", text: `QR ${qrmm} mm — marginal on poly` });

  const capacity = fieldCapacity(engine, thermalPreset, a4Preset, typography);
  if (fieldsOnCount > capacity) flags.push({ level: "bad", text: `${fieldsOnCount} fields exceed label height` });

  return flags;
}

// Text lines for one A4/PDF label, honouring the Tag content checkboxes. Shared by the on-screen
// sheet preview, the print sheet and the PDF so a toggle changes all three the same way.
// Price is always per piece — never a set total — on parent, child and loose tags alike.
export function buildTagLines(tag, data, fields) {
  const f = fields[tag.kind] ?? {};
  const isParent = tag.kind === "parent";
  const lines = [];
  if (f.firm) lines.push({ text: data.firm, style: "muted" });
  lines.push({ text: tag.code, style: "title" });
  lines.push({ text: `${f.design === false ? "" : `${data.designCode} · `}${data.variantName}`, style: "muted" });
  if (f.dname && data.designName) lines.push({ text: data.designName, style: "muted" });
  if (isParent) {
    const label = tag.isSemiSet ? "SEMI" : "SET";
    lines.push({ text: f.comp ? `${label}: ${data.composition} (${tag.piecesPerSet} Pcs)` : `${label} ${tag.piecesPerSet}-PC`, style: "bold" });
  } else {
    if (f.size) lines.push({ text: `SIZE ${tag.size}`, style: "bold" });
    if (tag.kind === "child" && f.parent && tag.parentId) lines.push({ text: `PARENT: ${tag.parentId}`, style: "muted" });
  }
  if (f.jobber) lines.push({ text: data.jobber, style: "muted" });
  if (f.price) lines.push({ text: `MRP ${data.piecePrice} / PC`, style: "price" });
  if (tag.kind === "loose" && f.origin) lines.push({ text: "LOOSE — FROM JOBBER", style: "bold" });
  if (f.date && (isParent || tag.kind === "loose")) lines.push({ text: `${tag.kind === "loose" ? "LOOSE SINCE" : "INWARD"} ${data.date}`, style: "muted" });
  return lines;
}
