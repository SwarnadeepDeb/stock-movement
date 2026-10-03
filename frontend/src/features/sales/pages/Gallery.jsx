import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Check,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Receipt,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGalleryApi } from "../hooks/useSalesApi.js";
import { useOrderFormsApi } from "../hooks/useOrderFormsApi.js";
import { useInvoicesApi } from "../hooks/useInvoicesApi.js";
import { inr, longDate } from "../utils/format.js";
import PhotoLightbox from "../components/PhotoLightbox.jsx";
import GalleryFilters from "../components/gallery/GalleryFilters.jsx";
import { createMatcher, freshFilters } from "../utils/galleryFilters.js";

const MODES = [
  { key: "orderForm", label: "By order form", Icon: FileText },
  { key: "invoice", label: "By invoice", Icon: Receipt },
  { key: "all", label: "All photos", Icon: ImageIcon },
];

const SIZES = [
  { key: "s", label: "S", title: "Small photos — see the most at once", min: 118, minPhone: 78 },
  { key: "m", label: "M", title: "Medium photos", min: 160, minPhone: 110 },
  { key: "l", label: "L", title: "Large photos", min: 220, minPhone: 160 },
];

// How the photo wall is laid out is a per-browser preference, not data — kept in localStorage.
const VIEW_KEY = "gallery.view";
const readView = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) || "null");
    return {
      size: /^[sml]$/.test(saved?.size) ? saved.size : "s",
      group: typeof saved?.group === "boolean" ? saved.group : false,
    };
  } catch {
    return { size: "s", group: false };
  }
};

const fileNameOf = (item) =>
  `${item.designCode}-${item.colorName.replace(/\s+/g, "-")}.jpg`;

const Seg = ({ value, onChange, options, label }) => (
  <div
    role="group"
    aria-label={label}
    className="inline-flex gap-0.5 rounded-[9px] border border-slate-200 bg-slate-100 p-0.5"
  >
    {options.map(([key, text, title]) => (
      <button
        key={key}
        type="button"
        title={title}
        aria-pressed={value === key}
        onClick={() => onChange(key)}
        className={cn(
          "min-w-[30px] whitespace-nowrap rounded-[7px] px-2.5 py-1 text-xs font-semibold text-slate-500",
          value === key && "bg-white text-slate-900 shadow-sm",
        )}
      >
        {text}
      </button>
    ))}
  </div>
);

// Select-all style box: checked, empty, or "mixed" (some picked).
const Box = ({ state, className, ...rest }) => (
  <button
    type="button"
    className={cn(
      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] disabled:cursor-not-allowed disabled:opacity-40",
      state === "none"
        ? "border-slate-300 bg-white text-transparent"
        : "border-emerald-600 bg-emerald-600 text-white",
      className,
    )}
    {...rest}
  >
    {state === "all" && <Check className="h-3 w-3" strokeWidth={3} />}
    {state === "some" && <span className="h-0.5 w-2.5 rounded bg-white" />}
  </button>
);

const Gallery = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState(searchParams.get("mode") ?? "orderForm");
  const [numberInput, setNumberInput] = useState(
    searchParams.get("number") ?? "",
  );
  const [submittedNumber, setSubmittedNumber] = useState(
    searchParams.get("number") ?? "",
  );
  // Filtering happens here, over whatever was fetched — the whole catalogue or one document —
  // so each facet can show live counts. Reset whenever what's being filtered changes.
  const [filters, setFilters] = useState(freshFilters);
  // colorVariantId → the selected gallery item itself (not the id alone), so Share and Download
  // work from this rather than from what's currently on screen.
  const [selected, setSelected] = useState({});
  const [anchor, setAnchor] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [view, setView] = useState(readView);
  const [includeRates, setIncludeRates] = useState(false);
  const [shareFallback, setShareFallback] = useState(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const blurTimer = useRef(null);

  const updateView = (patch) => {
    const next = { ...view, ...patch };
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(next));
    } catch {
      // Private mode etc. — the preference just won't persist.
    }
  };

  const {
    data: response,
    isPending,
    isError,
    error,
  } = useGalleryApi(
    { mode, number: submittedNumber },
    mode === "all" || Boolean(submittedNumber),
  );

  const items = useMemo(() => response?.data?.items ?? [], [response]);
  const source = response?.data?.source;
  const fetched = mode === "all" || (Boolean(submittedNumber) && !isError && !isPending && Boolean(source));

  // Typing in the fetch box suggests matching documents, and the empty state offers recent ones.
  const typed = useDebouncedValue(numberInput.trim(), 200);
  const isOrderMode = mode === "orderForm";
  const { data: orderList } = useOrderFormsApi({ q: typed, limit: 6 });
  const { data: invoiceList } = useInvoicesApi({ q: typed, limit: 6 });
  const { data: recentOrders } = useOrderFormsApi({ limit: 5 });
  const { data: recentInvoices } = useInvoicesApi({ limit: 5 });

  const toRow = (record) =>
    isOrderMode
      ? {
          number: record.formNumber,
          party: record.party.name,
          date: record.formDate,
          sub: `${record.party.name} · ${record.totalPcs} pcs · ${record.status === "OPEN" ? "Open" : "Invoiced"}`,
        }
      : {
          number: record.invoiceNumber,
          party: record.party.name,
          date: record.invoiceDate,
          sub: `${record.party.name} · order ${record.orderFormNumber} · ${record.totalPcs} pcs`,
        };
  const suggestions = ((isOrderMode ? orderList : invoiceList)?.data ?? [])
    .slice(0, 6)
    .map(toRow);
  const recent = ((isOrderMode ? recentOrders : recentInvoices)?.data ?? [])
    .slice(0, 5)
    .map(toRow);

  const matches = useMemo(
    () => createMatcher(items, filters, mode),
    [items, filters, mode],
  );
  const visible = useMemo(
    () => items.filter((item) => matches(item)),
    [items, matches],
  );

  // Grouped by designId, not code: a code is only unique within a pattern, so two designs can
  // share one. The flat grid uses the same order, so nothing jumps when switching layout.
  const grouped = useMemo(() => {
    const byDesign = new Map();

    for (const item of visible) {
      const group = byDesign.get(item.designId) ?? {
        designId: item.designId,
        designCode: item.designCode,
        designName: item.designName,
        itemName: item.itemName,
        quality: item.quality,
        unitPrice: item.unitPrice,
        items: [],
      };
      group.items.push(item);
      byDesign.set(item.designId, group);
    }

    return [...byDesign.values()];
  }, [visible]);

  const ordered = useMemo(() => grouped.flatMap((group) => group.items), [grouped]);
  const selectable = useMemo(() => ordered.filter((item) => item.hasPhoto), [ordered]);
  const withoutPhoto = ordered.filter((item) => !item.hasPhoto);

  // A fetched order form / invoice starts with every photo ticked (the salesperson is sending
  // that document's designs); the whole catalogue starts empty.
  // Done while rendering (not in an effect) so the first paint already has the ticks.
  const [seededFor, setSeededFor] = useState(null);
  if (mode !== "all" && submittedNumber && response && seededFor !== response) {
    const next = {};
    for (const item of items) if (item.hasPhoto) next[item.colorVariantId] = item;
    setSeededFor(response);
    setSelected(next);
    setAnchor(null);
  }

  const chosen = Object.values(selected);
  const chosenDesignCount = new Set(chosen.map((item) => item.designId)).size;

  const stateOf = (list) => {
    const count = list.filter((item) => selected[item.colorVariantId]).length;
    return list.length > 0 && count === list.length ? "all" : count > 0 ? "some" : "none";
  };

  const setMany = (list, on) =>
    setSelected((previous) => {
      const next = { ...previous };
      for (const item of list) {
        if (on) next[item.colorVariantId] = item;
        else delete next[item.colorVariantId];
      }
      return next;
    });

  // Tap = toggle; shift-tap = set everything between the last tap and this one.
  const toggleItem = (item, range) => {
    const from = selectable.findIndex((candidate) => candidate.colorVariantId === anchor);
    const to = selectable.findIndex((candidate) => candidate.colorVariantId === item.colorVariantId);

    if (range && from >= 0 && to >= 0 && from !== to) {
      setMany(selectable.slice(Math.min(from, to), Math.max(from, to) + 1), !selected[item.colorVariantId]);
    } else {
      setMany([item], !selected[item.colorVariantId]);
    }
    setAnchor(item.colorVariantId);
  };

  const switchMode = (key) => {
    if (key === mode) return;
    setMode(key);
    setSubmittedNumber("");
    setNumberInput("");
    setFilters(freshFilters());
    setSelected({});
    setAnchor(null);
  };

  const fetchNumber = (value) => {
    const number = (value ?? numberInput).trim();
    setSuggestOpen(false);
    setSubmittedNumber(number);
    setFilters(freshFilters());
    setSelected({});
    setAnchor(null);
  };

  const pcsCount = withoutPhoto.length;
  const hintNode = (() => {
    if (mode === "all") return null;
    if (isError && submittedNumber) {
      const near = suggestions.filter((row) => row.number.toLowerCase() !== submittedNumber.toLowerCase()).slice(0, 4);
      return (
        <div className="mt-1.5 min-h-4 text-xs text-red-600">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          {error.message}
          {near.length > 0 && (
            <>
              {" "}Did you mean{" "}
              {near.map((row, index) => (
                <span key={row.number}>
                  {index > 0 && ", "}
                  <button
                    type="button"
                    className="font-mono font-bold text-blue-700 underline"
                    onClick={() => {
                      setNumberInput(row.number);
                      fetchNumber(row.number);
                    }}
                  >
                    {row.number}
                  </button>
                </span>
              ))}
              ?
            </>
          )}
        </div>
      );
    }
    if (fetched && source) {
      const withPhoto = items.filter((item) => item.hasPhoto).length;
      return (
        <div className="mt-1.5 min-h-4 text-xs text-emerald-600">
          <Check className="mr-1 inline h-3 w-3" strokeWidth={2.6} />
          Fetched <b>{source.number}</b> · {source.party} · {withPhoto} photo{withPhoto === 1 ? "" : "s"}
        </div>
      );
    }
    return (
      <div className="mt-1.5 min-h-4 text-xs text-slate-400">
        {isOrderMode
          ? "Case doesn’t matter. Start typing to see matching order forms."
          : "Case doesn’t matter. Start typing to see matching invoices."}
      </div>
    );
  })();

  /* ------------------------------ sharing ------------------------------ */

  const message = (list) => {
    const head =
      source?.kind === "orderForm"
        ? `Designs for order form ${source.number} (${source.party})`
        : source?.kind === "invoice"
          ? `Designs in invoice ${source.number} (${source.party})`
          : "Our designs";

    return `${head}:\n${list
      .map(
        (item) =>
          `• ${item.designCode} ${item.itemName ?? ""} – ${item.colorName}${includeRates ? ` – ${inr(item.unitPrice)}/pc` : ""}`.replace("  ", " "),
      )
      .join("\n")}`;
  };

  const fetchFile = async (item) => {
    const blob = await fetch(item.imageUrl).then((res) => res.blob());
    return new File([blob], fileNameOf(item), { type: blob.type || "image/jpeg" });
  };

  const download = async (list) => {
    list = list.filter((item) => item.hasPhoto);
    if (list.length === 0) return;

    toast.success(
      list.length > 1
        ? `Downloading ${list.length} photos… if your browser asks, allow multiple downloads.`
        : `Downloading ${fileNameOf(list[0])}`,
    );

    list.forEach((item, index) => {
      // Spaced out, or the browser blocks the burst as a popup flood.
      setTimeout(async () => {
        const link = document.createElement("a");
        let objectUrl = null;
        try {
          // Photos live on a CDN, where the download attribute is ignored — pull the bytes first.
          objectUrl = URL.createObjectURL(await fetch(item.imageUrl).then((res) => res.blob()));
          link.href = objectUrl;
        } catch {
          link.href = item.imageUrl;
          link.target = "_blank";
        }
        link.download = fileNameOf(item);
        document.body.appendChild(link);
        link.click();
        link.remove();
        if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }, index * 250);
    });
  };

  const share = async (list) => {
    list = list.filter((item) => item.hasPhoto);
    if (list.length === 0) return toast.error("Select at least one photo.");

    const text = message(list);

    try {
      const files = await Promise.all(list.map(fetchFile));

      if (navigator.share && navigator.canShare?.({ files })) {
        await navigator.share({ files, text, title: "Designs" });
        return;
      }

      // Some phones can share files, just not this many at once — say how many they can.
      if (files.length > 1 && navigator.share && navigator.canShare?.({ files: files.slice(0, 1) })) {
        let max = 1;
        while (max < files.length && navigator.canShare({ files: files.slice(0, max + 1) })) max += 1;
        setShareFallback({
          list,
          text,
          reason: `This device can share up to ${max} photo${max > 1 ? "s" : ""} at a time, and you’ve selected ${files.length}. Share them in smaller batches, or download them all below.`,
        });
        return;
      }
    } catch (shareError) {
      if (shareError?.name === "AbortError") return; // the user closed the share sheet
      setShareFallback({
        list,
        text,
        reason: `Your device couldn’t share ${list.length} photo${list.length > 1 ? "s" : ""} at once. Try fewer, or use the options below.`,
      });
      return;
    }

    setShareFallback({ list, text, reason: null });
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Message copied.");
    } catch {
      toast.error("Couldn’t copy — select the text and copy it manually.");
    }
  };

  const size = SIZES.find((candidate) => candidate.key === view.size);
  const gridStyle = {
    "--gmin": `${size.min}px`,
    "--gmin-phone": `${size.minPhone}px`,
  };
  const compact = view.size === "s";

  const card = (item) => {
    const isSelected = Boolean(selected[item.colorVariantId]);
    const lightboxAt = selectable.findIndex(
      (candidate) => candidate.colorVariantId === item.colorVariantId,
    );

    if (!item.hasPhoto) {
      return (
        <div
          key={item.colorVariantId}
          title="No photo in Design Master"
          className="relative cursor-default overflow-hidden rounded-[10px] border border-slate-200 bg-white opacity-85"
        >
          <div className="relative aspect-[4/5] bg-[repeating-linear-gradient(45deg,#F1F5F9,#F1F5F9_10px,#fff_10px,#fff_20px)]">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-[11px] text-slate-400">
              <AlertTriangle className="h-[18px] w-[18px]" />
              <span>No photo</span>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex min-w-0 items-center gap-1.5 bg-gradient-to-b from-transparent to-slate-900/85 px-2 pb-1.5 pt-[18px] text-[11.5px] text-white">
              <b className="shrink-0 font-mono">{item.designCode}</b>
              <span className="truncate text-slate-200">{item.colorName}</span>
            </div>
          </div>
          {!compact && (
            <div className="flex items-center justify-between gap-1.5 px-2 py-1.5 text-[11.5px] text-slate-500">
              <span className="truncate">{item.label}</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={item.colorVariantId}
        role="checkbox"
        aria-checked={isSelected}
        aria-label={`${item.designCode} ${item.colorName}`}
        tabIndex={0}
        title={`${item.designCode} · ${item.colorName} · ${item.itemName ?? item.designName} · ${item.label}`}
        onClick={(event) => toggleItem(item, event.shiftKey)}
        onDoubleClick={(event) => {
          event.preventDefault();
          setLightboxIndex(lightboxAt);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === " ") {
            event.preventDefault();
            toggleItem(item, event.shiftKey);
          } else if (event.key === "Enter") {
            event.preventDefault();
            setLightboxIndex(lightboxAt);
          }
        }}
        className={cn(
          "group relative cursor-pointer select-none overflow-hidden rounded-[10px] border bg-white outline-none transition-shadow focus-visible:shadow-[0_0_0_3px_#BFDBFE]",
          isSelected
            ? "border-emerald-600 shadow-[0_0_0_2px_#059669]"
            : "border-slate-200 hover:border-slate-300",
        )}
      >
        <div className="relative aspect-[4/5] bg-slate-100">
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover"
          />

          <span
            className={cn(
              "pointer-events-none absolute left-1.5 top-1.5 flex items-center justify-center rounded-[7px] shadow-[0_1px_4px_rgba(15,23,42,0.3)]",
              compact ? "h-[19px] w-[19px] sm:h-[22px] sm:w-[22px]" : "h-[22px] w-[22px]",
              isSelected ? "bg-emerald-600 text-white" : "bg-white/90 text-transparent",
            )}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>

          {item.isExtra && (
            <span className={cn(
              "absolute left-[34px] top-2 rounded-[5px] bg-violet-700 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white",
              compact && "max-sm:hidden",
            )}>
              EXTRA
            </span>
          )}

          <div className="absolute right-1.5 top-1.5 flex flex-col gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            {[
              { Icon: Eye, label: "View larger", run: () => setLightboxIndex(lightboxAt), always: true },
              { Icon: Download, label: "Download", run: () => download([item]) },
              { Icon: Share2, label: "Share this photo", run: () => share([item]) },
            ].map(({ Icon, label, run, always }) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                onClick={(event) => {
                  event.stopPropagation();
                  run();
                }}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-lg bg-white/95 text-slate-900 shadow-[0_1px_4px_rgba(15,23,42,0.25)] hover:bg-white hover:text-emerald-600",
                  compact && "max-sm:h-6 max-sm:w-6",
                  !always && "[@media(hover:none)]:hidden",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <div className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 flex min-w-0 items-center gap-1.5 bg-gradient-to-b from-transparent to-slate-900/85 px-2 pb-1.5 pt-[18px] text-[11.5px] leading-tight text-white",
            compact && "max-sm:px-[5px] max-sm:pb-1 max-sm:pt-3.5 max-sm:text-[10px]",
          )}>
            <span
              className={cn("h-[9px] w-[9px] shrink-0 rounded-full border border-white/75", compact && "max-sm:hidden")}
              style={{ background: item.colorHex }}
            />
            <b className="shrink-0 font-mono">{item.designCode}</b>
            <span className={cn("truncate text-slate-200", compact && "max-sm:hidden")}>{item.colorName}</span>
          </div>
        </div>

        {!compact && (
          <div className="flex items-center justify-between gap-1.5 px-2 py-1.5 text-[11.5px] text-slate-500">
            <span className="truncate">{item.label}</span>
            <b className="whitespace-nowrap font-mono text-slate-900">{inr(item.unitPrice)}</b>
          </div>
        )}
      </div>
    );
  };

  const grid = (list) => (
    <div
      className="grid gap-2.5 max-sm:gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(var(--gmin),1fr))] max-sm:[grid-template-columns:repeat(auto-fill,minmax(var(--gmin-phone),1fr))]"
      style={gridStyle}
    >
      {list.map(card)}
    </div>
  );

  const showSuggestions = suggestOpen && suggestions.length > 0;
  const cardClass = "rounded-[14px] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.05)] max-sm:p-3";

  return (
    <div className="stock-out flex flex-col gap-3 pb-24 font-sans">
      {/* Card 1 — where the photos come from */}
      <div className={cardClass}>
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5">
          <h1 className="m-0 text-xl font-bold tracking-tight text-slate-900">Gallery</h1>
          <span className="min-w-[220px] flex-1 text-[12.5px] text-slate-500 max-sm:hidden">
            Pick photos from an order form, an invoice or the full catalogue, then share them.
          </span>
          <div role="tablist" className="inline-flex gap-0.5 rounded-[11px] border border-slate-200 bg-slate-100 p-[3px] max-sm:flex max-sm:w-full">
            {MODES.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => switchMode(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-[15px] py-2 text-[13px] font-semibold text-slate-500 hover:text-slate-900 max-sm:flex-1 max-sm:justify-center max-sm:px-1 max-sm:text-[12.3px]",
                  mode === key && "bg-white text-emerald-800 shadow-sm hover:text-emerald-800",
                )}
              >
                <Icon className={cn("h-[15px] w-[15px]", mode === key && "text-emerald-600")} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {mode !== "all" && (
          <div className="relative mt-3">
            <div className="flex items-stretch gap-2.5 max-sm:flex-col">
              <div className="relative flex-1">
                <FileTextOrReceipt mode={mode} />
                <input
                  value={numberInput}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setNumberInput(event.target.value);
                    setHighlight(-1);
                    setSuggestOpen(true);
                  }}
                  onFocus={() => {
                    clearTimeout(blurTimer.current);
                    setSuggestOpen(true);
                  }}
                  onBlur={() => {
                    blurTimer.current = setTimeout(() => setSuggestOpen(false), 120);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && showSuggestions) {
                      event.preventDefault();
                      setHighlight((index) => Math.min(index + 1, suggestions.length - 1));
                    } else if (event.key === "ArrowUp" && showSuggestions) {
                      event.preventDefault();
                      setHighlight((index) => Math.max(index - 1, 0));
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      const pick = showSuggestions && highlight >= 0 ? suggestions[highlight].number : numberInput;
                      setNumberInput(pick);
                      fetchNumber(pick);
                    } else if (event.key === "Escape") {
                      setSuggestOpen(false);
                    }
                  }}
                  placeholder={
                    isOrderMode
                      ? "Type the order form number, e.g. OF-1022"
                      : "Type the invoice number, e.g. INV-2026-041"
                  }
                  className="w-full rounded-xl border-2 border-emerald-200 bg-emerald-50 py-[11px] pl-[46px] pr-4 font-mono text-sm text-slate-900 outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchNumber()}
                className="shrink-0 rounded-[9px] border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-emerald-700"
              >
                Fetch photos
              </button>
            </div>

            {showSuggestions && (
              <div className="absolute inset-x-0 top-[52px] z-30 max-h-[280px] overflow-y-auto rounded-[11px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.12)] sm:right-[150px]">
                {suggestions.map((row, index) => (
                  <div
                    key={row.number}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setNumberInput(row.number);
                      fetchNumber(row.number);
                    }}
                    className={cn(
                      "flex cursor-pointer justify-between gap-2.5 border-b border-slate-200 px-3.5 py-2.5 last:border-b-0 hover:bg-emerald-50",
                      index === highlight && "bg-emerald-50",
                    )}
                  >
                    <div>
                      <div className="font-mono text-[13.3px] font-semibold">{row.number}</div>
                      <div className="text-[11.6px] text-slate-500">{row.sub}</div>
                    </div>
                    <div className="text-[11.6px] text-slate-500">{longDate(row.date)}</div>
                  </div>
                ))}
              </div>
            )}

            {hintNode}
          </div>
        )}

        {mode !== "all" && fetched && source?.number && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-slate-200 bg-slate-50 py-[7px] pl-3 pr-2 text-[12.6px] text-slate-700">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              {source.kind === "invoice" ? "Invoice" : "Order form"}
            </span>
            <span className="font-mono text-sm font-bold text-slate-900">{source.number}</span>
            <span>
              <b>{source.party}</b> · {longDate(source.date)}
              {source.kind === "invoice" && source.orderFormNumber ? ` · order ${source.orderFormNumber}` : ""}
              {` · ${source.totalPcs} pcs`}
              {source.kind === "invoice" && source.totalAmount != null ? ` · ${inr(source.totalAmount)}` : ""}
            </span>
            <button
              type="button"
              onClick={() =>
                navigate(
                  source.kind === "invoice"
                    ? `/stock-out/invoices/${source.id}`
                    : `/stock-out/orders/${source.id}`,
                )
              }
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Eye className="h-[13px] w-[13px]" />
              Open {source.kind === "invoice" ? "invoice" : "order form"}
            </button>
          </div>
        )}
      </div>

      {/* Card 2 — search + filters (sticks to the top while the photos scroll) */}
      {items.length > 0 && (
        <div className={cn(cardClass, "z-30 px-3 py-2.5 sm:sticky sm:top-2")}>
          <GalleryFilters
            items={items}
            filters={filters}
            onChange={setFilters}
            mode={mode}
            matches={matches}
            visibleCount={visible.length}
          />
        </div>
      )}

      {/* Card 3 — the photos */}
      {mode !== "all" && !submittedNumber ? (
        <div className={cardClass}>
          <div className="flex flex-col items-center gap-1.5 px-5 py-[34px] text-center">
            <div className="mb-1.5 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              {isOrderMode ? <FileText className="h-[26px] w-[26px]" strokeWidth={1.6} /> : <Receipt className="h-[26px] w-[26px]" strokeWidth={1.6} />}
            </div>
            <b className="text-[15px]">
              {isOrderMode ? "Enter an order form number to see its photos" : "Enter an invoice number to see its photos"}
            </b>
            <span className="max-w-[48ch] text-[13px] text-slate-500">
              {isOrderMode
                ? "Every design and variant the customer asked for will appear here."
                : "Every design and variant actually billed will appear here, including extras."}
            </span>
            {recent.length > 0 && (
              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-y-0.5">
                <span className="mr-2 text-[11.5px] text-slate-400">Recent</span>
                {recent.map((row) => (
                  <button
                    key={row.number}
                    type="button"
                    onClick={() => {
                      setNumberInput(row.number);
                      fetchNumber(row.number);
                    }}
                    className="mb-1.5 mr-1.5 inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-slate-300 bg-white px-2.5 py-1.5 font-mono text-[11.6px] font-semibold text-slate-700 hover:border-emerald-600 hover:text-slate-900"
                  >
                    <span className="rounded bg-slate-100 px-1.5 py-px font-sans text-[9.5px] font-bold tracking-wide text-slate-500">
                      {row.party.split(" ")[0]}
                    </span>
                    {row.number}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : isError ? null : isPending ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className={cn(cardClass, "px-3.5 pb-4 pt-3 max-sm:p-2.5")}>
          <div className="mb-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-2">
            <div className="flex items-center gap-2.5 text-[13.3px] font-semibold">
              <Box
                state={stateOf(selectable)}
                disabled={selectable.length === 0}
                aria-label="Select all"
                onClick={() => setMany(selectable, stateOf(selectable) !== "all")}
              />
              <span>
                Select all <span className="text-slate-400">({selectable.length})</span>
              </span>
            </div>
            <span className="text-[12.8px] text-slate-500">
              {chosen.length > 0 ? `${chosen.length} selected` : ""}
            </span>
            <span className="inline-flex items-center gap-1 text-[11.8px] text-slate-400 max-sm:hidden">
              Tap a photo to pick it · Shift-click picks a range · <Eye className="h-3 w-3" /> opens it large
            </span>
            <div className="ml-auto flex items-center gap-2 max-sm:ml-0 max-sm:w-full max-sm:justify-between">
              <Seg
                label="Layout"
                value={view.group ? "1" : "0"}
                onChange={(key) => updateView({ group: key === "1" })}
                options={[
                  ["0", "Grid", "One continuous wall of photos"],
                  ["1", "By design", "Group the photos under each design"],
                ]}
              />
              <Seg
                label="Photo size"
                value={view.size}
                onChange={(key) => updateView({ size: key })}
                options={SIZES.map((option) => [option.key, option.label, option.title])}
              />
            </div>
          </div>

          {pcsCount > 0 && (
            <div
              title={withoutPhoto.map((item) => `${item.designCode} ${item.colorName}`).join(", ")}
              className="mb-2.5 flex items-center gap-2 rounded-[9px] border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                <b>
                  {pcsCount} variant{pcsCount > 1 ? "s have" : " has"} no photo
                </b>{" "}
                in Design Master and can’t be shared yet — shown greyed out below.
              </span>
            </div>
          )}

          {items.length === 0 ? (
            <div className="p-10 text-center text-[13.5px] text-slate-500">
              <b className="mb-1 block text-[15px] text-slate-900">No designs here yet</b>
              Designs registered in Design Master will appear here.
            </div>
          ) : visible.length === 0 ? (
            <div className="p-10 text-center text-[13.5px] text-slate-500">
              <b className="mb-1 block text-[15px] text-slate-900">No photos match these filters</b>
              Remove a filter chip above, or{" "}
              <button
                type="button"
                onClick={() => setFilters(freshFilters())}
                className="font-bold text-blue-700 underline"
              >
                clear all filters
              </button>
              .
            </div>
          ) : view.group ? (
            grouped.map((group, index) => {
              const groupSelectable = group.items.filter((item) => item.hasPhoto);

              return (
                <div key={group.designId}>
                  <div className={cn(
                    "mb-2 flex items-center gap-2.5 border-b border-slate-200 pb-1.5 text-[13px]",
                    index > 0 && "mt-4",
                  )}>
                    {groupSelectable.length > 0 && (
                      <Box
                        className="h-[18px] w-[18px]"
                        state={stateOf(groupSelectable)}
                        aria-label={`Select all of ${group.designCode}`}
                        onClick={() => setMany(groupSelectable, stateOf(groupSelectable) !== "all")}
                      />
                    )}
                    <b className="font-mono">{group.designCode}</b>
                    <span className="min-w-0 truncate text-xs text-slate-500">
                      {[group.itemName, group.designName, group.quality].filter(Boolean).join(" · ")}
                      {` · ${group.items.length} colour${group.items.length > 1 ? "s" : ""}`}
                    </span>
                    <b className="ml-auto whitespace-nowrap text-xs">{inr(group.unitPrice)} / pc</b>
                  </div>
                  {grid(group.items)}
                </div>
              );
            })
          ) : (
            grid(ordered)
          )}
        </div>
      )}

      {chosen.length > 0 && (
        <div className="sticky bottom-4 z-20">
          <div className="flex flex-wrap items-center gap-[18px] rounded-[14px] bg-slate-900 py-3 pl-5 pr-4 text-white shadow-[0_14px_40px_rgba(15,23,42,0.3)]">
            <div>
              <b>
                {chosen.length} photo{chosen.length === 1 ? "" : "s"} selected
              </b>
              <div className="text-[11.8px] text-slate-300">
                {source?.party ? `for ${source.party}` : `from ${chosenDesignCount} design${chosenDesignCount === 1 ? "" : "s"}`}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-[7px] text-[12.6px] text-slate-200">
              <input
                type="checkbox"
                checked={includeRates}
                onChange={(event) => setIncludeRates(event.target.checked)}
                className="h-[15px] w-[15px] accent-emerald-500"
              />
              Include rates in message
            </label>

            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelected({});
                  setAnchor(null);
                }}
                className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => download(chosen)}
                className="flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
              >
                <Download className="h-[13px] w-[13px]" /> Download
              </button>
              <button
                type="button"
                onClick={() => share(chosen)}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700"
              >
                <Share2 className="h-[13px] w-[13px]" /> Share {chosen.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
          items={selectable}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          selected={selected}
          onToggle={(colorVariantId) => {
            const item = selectable.find(
              (candidate) => candidate.colorVariantId === colorVariantId,
            );
            if (item) toggleItem(item, false);
          }}
          onShare={(item) => share([item])}
        />
      )}

      <Dialog open={Boolean(shareFallback)} onOpenChange={(open) => !open && setShareFallback(null)}>
        <DialogContent className="bg-white font-sans sm:max-w-[520px]">
          {shareFallback && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Share {shareFallback.list.length} photo{shareFallback.list.length > 1 ? "s" : ""}
                </DialogTitle>
              </DialogHeader>

              {shareFallback.reason ? (
                <div className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.8px] text-amber-800">
                  <AlertTriangle className="mt-0.5 h-[15px] w-[15px] shrink-0" />
                  <div>{shareFallback.reason}</div>
                </div>
              ) : (
                <p className="m-0 text-[13.3px] text-slate-700">
                  This browser can’t hand photos straight to WhatsApp or other apps. On a phone, open this page in Chrome or Safari to get the share sheet. Here you can:
                </p>
              )}

              <ol className="m-0 list-decimal pl-[18px] text-[13.3px] text-slate-700">
                <li><b>Download</b> the photos, then attach them in WhatsApp, Instagram or email.</li>
                <li><b>Copy the message</b> below and paste it with the photos.</li>
              </ol>

              <textarea
                readOnly
                rows={5}
                value={shareFallback.text}
                className="w-full resize-y rounded-[9px] border-[1.5px] border-slate-300 px-3 py-2.5 text-[12.3px] outline-none"
              />

              <DialogFooter className="flex-wrap gap-2">
                <button type="button" onClick={() => setShareFallback(null)} className="rounded-[9px] border border-slate-300 px-4 py-2 text-[13.5px] font-semibold text-slate-700 hover:bg-slate-100">
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareFallback.text)}`, "_blank", "noopener")}
                  className="rounded-[9px] border border-slate-300 px-4 py-2 text-[13.5px] font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Open WhatsApp (text)
                </button>
                <button type="button" onClick={() => copyText(shareFallback.text)} className="rounded-[9px] border border-slate-300 px-4 py-2 text-[13.5px] font-semibold text-slate-700 hover:bg-slate-100">
                  Copy message
                </button>
                <button
                  type="button"
                  onClick={() => {
                    download(shareFallback.list);
                    setShareFallback(null);
                  }}
                  className="rounded-[9px] border border-emerald-600 bg-emerald-600 px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-emerald-700"
                >
                  Download {shareFallback.list.length} photo{shareFallback.list.length > 1 ? "s" : ""}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const FileTextOrReceipt = ({ mode }) => {
  const Icon = mode === "orderForm" ? FileText : Receipt;
  return <Icon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-emerald-600" />;
};

export default Gallery;
