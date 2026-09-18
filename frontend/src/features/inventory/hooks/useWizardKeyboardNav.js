import { useEffect } from "react";

// Keyboard entry for the data-entry steps of the Stock In wizard:
//   Enter        → next field; on the last field, on to the next step
//   Shift+Enter  → previous field
//   ← ↑ → ↓      → move to the neighbouring field (in a text box only at its start / end)
// Search comboboxes (jobber, design) keep their own Enter / arrow behaviour — they are valid
// places to land but never intercepted. A field can opt out of the Enter order with
// data-enter-skip (e.g. a value the wizard fills in itself).
const FIELD_SELECTOR = "input, select, textarea";
const SKIPPED_TYPES = /^(checkbox|radio|range|hidden|button|submit)$/;

const isCombobox = (el) => el.getAttribute("role") === "combobox" || el.getAttribute("aria-autocomplete") === "list";

const isUsable = (el) => !el.disabled && !el.readOnly && el.offsetParent !== null && !SKIPPED_TYPES.test(el.type);

const listFields = (container, { forEnter }) =>
  [...container.querySelectorAll(FIELD_SELECTOR)].filter((el) => isUsable(el) && !(forEnter && el.hasAttribute("data-enter-skip")));

function focusField(el) {
  if (!el) return;
  el.focus();
  try {
    if (el.select && el.type !== "date") el.select();
  } catch {
    /* some input types have no selection */
  }
  el.scrollIntoView({ block: "center", behavior: "smooth" });
}

const caretAt = (el, edge) => {
  try {
    const { selectionStart: start, selectionEnd: end } = el;
    if (start === null || start === undefined) return true;
    if (start !== end) return false;
    return edge === "start" ? start === 0 : start === el.value.length;
  } catch {
    return true;
  }
};

function neighbour(container, from, direction) {
  const fields = listFields(container, { forEnter: false });
  const rect = from.getBoundingClientRect();
  const centreX = rect.left + rect.width / 2;
  const centreY = rect.top + rect.height / 2;

  if (direction === "down" || direction === "up") {
    const candidates = fields.filter((el) => {
      if (el === from) return false;
      const box = el.getBoundingClientRect();
      return direction === "down" ? box.top >= rect.bottom - 4 : box.bottom <= rect.top + 4;
    });
    if (!candidates.length) return null;
    const gap = (el) => {
      const box = el.getBoundingClientRect();
      return direction === "down" ? box.top - rect.bottom : rect.top - box.bottom;
    };
    const nearestRow = Math.min(...candidates.map(gap));
    const row = candidates.filter((el) => gap(el) <= nearestRow + 12);
    return row.reduce((best, el) => {
      const box = el.getBoundingClientRect();
      const distance = Math.abs(box.left + box.width / 2 - centreX);
      return !best || distance < best.distance ? { el, distance } : best;
    }, null)?.el;
  }

  const sameRow = fields.filter((el) => {
    if (el === from) return false;
    const box = el.getBoundingClientRect();
    return (
      Math.abs(box.top + box.height / 2 - centreY) < Math.max(rect.height, box.height) / 2 + 6 &&
      (direction === "right" ? box.left >= rect.right - 4 : box.right <= rect.left + 4)
    );
  });
  const best = sameRow.reduce((found, el) => {
    const box = el.getBoundingClientRect();
    const distance = direction === "right" ? box.left - rect.right : rect.left - box.right;
    return !found || distance < found.distance ? { el, distance } : found;
  }, null);
  if (best) return best.el;

  const index = fields.indexOf(from);
  return direction === "right" ? fields[index + 1] ?? null : fields[index - 1] ?? null;
}

export function useWizardKeyboardNav({ containerRef, enabled, onAdvance }) {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      const container = containerRef.current;
      const target = event.target;
      if (!container || !target?.closest || !container.contains(target)) return;
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (document.querySelector('[role="dialog"]') || !target.matches?.(FIELD_SELECTOR)) return;

      if (event.key === "Enter") {
        if (isCombobox(target)) return;
        const fields = listFields(container, { forEnter: true });
        const index = fields.indexOf(target);
        if (index < 0) return;
        event.preventDefault();
        if (event.shiftKey) {
          if (index > 0) focusField(fields[index - 1]);
        } else if (index < fields.length - 1) {
          focusField(fields[index + 1]);
        } else {
          onAdvance();
        }
        return;
      }

      const direction = { ArrowDown: "down", ArrowUp: "up", ArrowLeft: "left", ArrowRight: "right" }[event.key];
      if (!direction || event.shiftKey || isCombobox(target)) return;
      const horizontal = direction === "left" || direction === "right";
      if (target.type === "date" && horizontal) return;
      if (target.tagName === "TEXTAREA" && !caretAt(target, direction === "up" || direction === "left" ? "start" : "end")) return;
      if (horizontal && target.tagName === "INPUT" && target.type !== "number" && !caretAt(target, direction === "left" ? "start" : "end")) return;
      const to = neighbour(container, target, direction);
      event.preventDefault(); // also stops arrows from nudging number boxes and dropdowns
      if (to) focusField(to);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [containerRef, enabled, onAdvance]);
}
