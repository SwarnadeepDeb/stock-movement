import { useEffect, useRef, useState } from "react";
import { Pipette } from "lucide-react";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex ?? "");
  if (!match) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
};

const rgbToHex = (r, g, b) => {
  const toHex = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

const rgbToHsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;

  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: max === 0 ? 0 : d / max, v: max };
};

const hsvToRgb = (h, s, v) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
};

const hexToHsv = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
};

const hsvToHex = (h, s, v) => {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
};

// Dependency-free stand-in for a hue/saturation-value picker (react-colorful etc. aren't
// installed and npm is broken in this environment) — rendered inside our own Popover so its
// placement (side="left") can be controlled, unlike the native <input type="color"> popup.
export const ColorPicker = ({ color, onChange }) => {
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const svRef = useRef(null);
  const hueRef = useRef(null);
  const draggingRef = useRef(null);

  useEffect(() => {
    if (hsvToHex(hsv.h, hsv.s, hsv.v).toLowerCase() !== (color ?? "").toLowerCase()) {
      setHsv(hexToHsv(color));
    }
    // Only resync when the external color changes, not on every local hsv update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  const emit = (next) => {
    setHsv(next);
    onChange(hsvToHex(next.h, next.s, next.v));
  };

  const updateFromSvEvent = (e) => {
    const rect = svRef.current.getBoundingClientRect();
    const s = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
    emit({ ...hsvRef.current, s, v });
  };

  const updateFromHueEvent = (e) => {
    const rect = hueRef.current.getBoundingClientRect();
    const h = clamp((e.clientX - rect.left) / rect.width, 0, 1) * 360;
    emit({ ...hsvRef.current, h });
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (draggingRef.current === "sv") updateFromSvEvent(e);
      if (draggingRef.current === "hue") updateFromHueEvent(e);
    };
    const handleUp = () => { draggingRef.current = null; };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hueColor = `hsl(${hsv.h}, 100%, 50%)`;

  // Restores what the native <input type="color"> picker offered — sampling a pixel from
  // anywhere on screen (e.g. the uploaded variant image) — since our custom picker replaced
  // that native popup to make its position controllable. Chromium-only; the button simply
  // doesn't render where window.EyeDropper is unavailable (Safari/Firefox).
  const pickFromScreen = async () => {
    if (!window.EyeDropper) return;
    try {
      const result = await new window.EyeDropper().open();
      onChange(result.sRGBHex.toUpperCase());
    } catch {
      // User pressed Escape / cancelled the pick — nothing to do.
    }
  };

  return (
    <div className="flex w-56 max-w-[calc(100vw-2rem)] flex-col gap-3">
      {typeof window !== "undefined" && window.EyeDropper && (
        <button
          type="button"
          onClick={pickFromScreen}
          className="flex items-center justify-center gap-2 rounded-lg border border-[#4C4A85] py-2 text-sm font-medium text-gray-700 hover:bg-muted"
        >
          <Pipette className="size-4" />
          Pick from image
        </button>
      )}

      <div
        ref={svRef}
        onPointerDown={(e) => { draggingRef.current = "sv"; updateFromSvEvent(e); }}
        className="relative h-36 w-full cursor-crosshair touch-none rounded-lg"
        style={{
          backgroundColor: hueColor,
          backgroundImage:
            "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
        }}
      >
        <div
          className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>

      <div
        ref={hueRef}
        onPointerDown={(e) => { draggingRef.current = "hue"; updateFromHueEvent(e); }}
        className="relative h-3 w-full cursor-pointer touch-none rounded-full"
        style={{
          backgroundImage:
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
      >
        <div
          className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }}
        />
      </div>
    </div>
  );
};
