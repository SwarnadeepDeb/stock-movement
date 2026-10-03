import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import jsQR from "jsqr";
import { AlertTriangle, Camera, Check, Keyboard, ScanLine, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Frames are downscaled to this width before jsQR reads them — plenty for a tag held in the
// frame, and keeps each read cheap enough for the 350ms scan loop.
const DECODE_WIDTH = 640;

// The browser's own BarcodeDetector where it exists (Chrome on Android/macOS), otherwise jsQR on
// a canvas snapshot of the video — desktop Chrome on Windows, Brave, Firefox and Safari have no
// BarcodeDetector. Either way: video element in, decoded text (or null) out.
function createDetector() {
    if ("BarcodeDetector" in window) {
        const native = new window.BarcodeDetector({ formats: ["qr_code", "code_128"] });
        return async (video) => (await native.detect(video))[0]?.rawValue ?? null;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    return async (video) => {
        if (!video.videoWidth) return null;

        const scale = Math.min(1, DECODE_WIDTH / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
        return jsQR(data, width, height, { inversionAttempts: "dontInvert" })?.data ?? null;
    };
}

const METHODS = [
    { key: "Manual", label: "Manual ID", Icon: Keyboard },
    { key: "QR Scanner", label: "QR Scanner", Icon: Camera },
    { key: "QR Gun", label: "QR Gun", Icon: ScanLine },
];

// Whole-number keys the live finders use for their hints.
export const Kbd = ({ children }) => (
    <span className="mx-0.5 inline-block rounded-[5px] border border-b-2 border-slate-300 bg-white px-1.5 font-mono text-[10.5px] font-bold text-slate-700">
        {children}
    </span>
);

// The three ways stock gets identified on the floor, behind one interface.
//
// Manual and QR Gun are the same text field — a gun is a keyboard that types very fast and
// presses Enter — but they are separate modes because the gun needs the field to keep focus and
// the operator needs to see that it is listening. QR Scanner uses the device camera where the
// browser supports it.
//
// `live` turns the Manual mode into a search box that answers as you type: the parent owns the
// text (`value` / `onChange`), handles the keyboard (`onKeyDown`) and supplies what to show under
// the box (`results`). Without it Manual is the plain type-an-ID-and-press-Enter field. The
// parent can call `ref.focus()` to put the cursor back in whichever box is showing.
const ScanPanel = forwardRef(function ScanPanel({ title, hint, placeholder, onScan, feedback, busy, manualLabel = "Manual ID", live }, ref) {
    const [method, setMethod] = useState("Manual");
    const [value, setValue] = useState("");
    const [cameraError, setCameraError] = useState("");
    const [cameraOn, setCameraOn] = useState(false);

    const inputRef = useRef(null);
    const liveInputRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const timerRef = useRef(null);
    const lastRef = useRef({ code: "", at: 0 });
    // The camera loop is an interval created once per Start — reading onScan through a ref means
    // it always calls the page's latest handler (and so sees the latest picked/requested items).
    const onScanRef = useRef(onScan);
    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);

    const focusInput = () => (liveInputRef.current ?? inputRef.current)?.focus();
    useImperativeHandle(ref, () => ({ focus: focusInput }));

    // Browsers only expose the camera on https or localhost.
    const cameraSupported = typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

    const stopCamera = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraOn(false);
    };

    // Whatever the mode, leaving the panel must release the camera — a page that keeps the lens
    // warm after you navigate away is a bug people notice as a hot phone.
    useEffect(() => stopCamera, []);
    useEffect(() => {
        if (method !== "QR Scanner") stopCamera();
        if (method !== "QR Scanner") setTimeout(focusInput, 0);
    }, [method]);

    const submit = (code, via = method) => {
        const trimmed = String(code ?? "").trim();
        if (!trimmed) return;

        onScanRef.current(trimmed, via);
        setValue("");
        inputRef.current?.focus();
    };

    const startCamera = async () => {
        setCameraError("");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setCameraOn(true);

            const detect = createDetector();

            timerRef.current = setInterval(async () => {
                try {
                    const code = await detect(videoRef.current);
                    if (!code) return;

                    const now = Date.now();
                    // A tag held in frame reads many times a second; without this the same set is
                    // added repeatedly while the operator is still lining up the next one.
                    if (code === lastRef.current.code && now - lastRef.current.at < 2500) return;

                    lastRef.current = { code, at: now };
                    submit(code, "QR Scanner");
                } catch {
                    // A single failed frame is not worth interrupting the scan loop for.
                }
            }, 350);
        } catch {
            setCameraError("Camera permission denied — allow camera access, or use the QR Gun.");
        }
    };

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-base font-bold text-[#1E1B4B]">{title}</h2>
                    <p className="text-xs text-[#1E1B4B]/60">{hint}</p>
                </div>

                <div className="toolbar-neu flex gap-1 rounded-xl p-1">
                    {METHODS.map(({ key, label, Icon }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setMethod(key)}
                            className={cn(
                                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                                method === key ? "bg-white text-[#1E1B4B] shadow-sm" : "text-[#1E1B4B]/60 hover:text-[#1E1B4B]",
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" /> {key === "Manual" ? manualLabel : label}
                        </button>
                    ))}
                </div>
            </div>

            {method === "QR Scanner" ? (
                <div>
                    <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-2xl bg-[#0F172A]">
                        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
                        <div className="relative h-32 w-32 rounded-xl border-[2.5px] border-white/85" />
                        <span className="absolute bottom-2 left-0 right-0 text-center text-[11.5px] text-slate-300">
                            {!cameraSupported ? "The camera is only available on https or localhost"
                                : cameraError ? cameraError
                                : cameraOn ? "Scanning… hold the tag inside the frame"
                                : "Tap Start camera, then point at the QR tag"}
                        </span>
                    </div>

                    <div className="mt-2 flex gap-2">
                        {cameraSupported ? (
                            <>
                                <button type="button" onClick={startCamera} className="neu-button rounded-full px-4 py-1.5 text-xs font-semibold text-[#1E1B4B]">
                                    Start camera
                                </button>
                                <button type="button" onClick={stopCamera} className="neu-button rounded-full px-4 py-1.5 text-xs font-semibold text-[#1E1B4B]">
                                    Stop
                                </button>
                            </>
                        ) : (
                            <span className="text-xs text-[#1E1B4B]/60">Open this page over https, or use the QR Gun / Manual ID.</span>
                        )}
                    </div>
                </div>
            ) : live && method === "Manual" ? (
                <div>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-emerald-600" />
                        <input
                            ref={liveInputRef}
                            role="combobox"
                            aria-expanded={Boolean(live.results)}
                            value={live.value}
                            autoComplete="off"
                            spellCheck={false}
                            onChange={(event) => {
                                const field = event.target;
                                const { selectionStart, selectionEnd } = field;
                                live.onChange(live.upper ? field.value.toUpperCase() : field.value);
                                // Upper-casing as you type would otherwise throw the cursor to the end.
                                if (live.upper) requestAnimationFrame(() => field.setSelectionRange(selectionStart, selectionEnd));
                            }}
                            onKeyDown={live.onKeyDown}
                            placeholder={live.placeholder}
                            className="w-full rounded-xl border-2 border-emerald-200 bg-emerald-50/60 py-3 pl-11 pr-11 font-mono text-sm text-[#1E1B4B] outline-none focus:border-emerald-500"
                        />
                        {live.value && (
                            <button
                                type="button"
                                aria-label="Clear"
                                onClick={() => { live.onChange(""); focusInput(); }}
                                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-slate-900/5 text-slate-500 hover:bg-slate-900/10 hover:text-slate-900"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    {live.hint && <p className="mt-1.5 text-[11.5px] text-[#1E1B4B]/50">{live.hint}</p>}
                    {live.results && <div className="mt-3">{live.results}</div>}
                </div>
            ) : (
                <div>
                    {method === "QR Gun" && (
                        <div className="mb-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-600" />
                            <div>
                                <b className="text-xs text-emerald-900">Ready — pull the trigger</b>
                                <p className="text-[11px] text-emerald-800/70">
                                    The gun types into the field below. Keep it focused while scanning.
                                </p>
                            </div>
                        </div>
                    )}

                    <input
                        ref={inputRef}
                        value={value}
                        disabled={busy}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) => setValue(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            submit(event.currentTarget.value);
                        }}
                        placeholder={placeholder}
                        className="w-full rounded-xl border-2 border-emerald-200 bg-emerald-50/60 px-4 py-3 font-mono text-sm text-[#1E1B4B] outline-none focus:border-emerald-500"
                    />
                    <p className="mt-1.5 text-[11.5px] text-[#1E1B4B]/50">
                        Type or scan the ID and press <b>Enter</b>.
                    </p>
                </div>
            )}

            {feedback && (
                <div className={cn(
                    "mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
                    feedback.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : feedback.tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-red-200 bg-red-50 text-red-900",
                )}>
                    {feedback.tone === "ok" ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>{feedback.message}</span>
                </div>
            )}
        </div>
    );
});

export default ScanPanel;