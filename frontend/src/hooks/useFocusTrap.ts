import { useEffect, type RefObject } from "react";

/** Everything the browser will hand focus to, minus anything explicitly removed. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Keep Tab inside a container while it is open, and give focus back when it
 * closes.
 *
 * A dialog that only *looks* modal is a keyboard trap in reverse: the scrim
 * blocks the mouse while Tab walks off into the page behind it, so a
 * keyboard-only admin ends up typing into controls they cannot see. Returning
 * focus to the element that opened the panel matters just as much — otherwise
 * closing Settings drops the caret back at the top of the document.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;

    // Remember where focus came from so it can be handed back on close.
    const opener = document.activeElement as HTMLElement | null;
    const container = ref.current;

    // Prefer the first real control; fall back to the container itself, which
    // carries tabIndex={-1} for exactly this case.
    const first = container?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? container)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !container) return;

      // Re-read on every Tab: panels change as their content loads.
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const start = items[0];
      const end = items[items.length - 1];
      const current = document.activeElement;

      if (e.shiftKey && (current === start || current === container)) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && current === end) {
        e.preventDefault();
        start.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Restore when focus is still inside the closing panel, or when it has
      // already fallen to <body> because React unmounted the panel out from
      // under it. Anything else means the user moved on deliberately — leave it.
      const active = document.activeElement;
      const orphaned = active === null || active === document.body;
      if (orphaned || !container || container.contains(active)) {
        // The opener may itself have unmounted; focus() on a detached node is a
        // silent no-op, which is the correct outcome.
        opener?.focus?.();
      }
    };
  }, [ref, active]);
}
