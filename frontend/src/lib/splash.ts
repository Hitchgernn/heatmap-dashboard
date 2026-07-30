/**
 * Dismissal of the boot splash defined in index.html.
 *
 * The splash paints before React exists (it covers both the bundle-parse gap and
 * the session check), so React's only job is to take it away once auth resolves.
 */

/** Never let the splash be visible for less than this — a warm cache would strobe it. */
const MIN_VISIBLE_MS = 450;
/** Must match the `transition: opacity` duration on #boot-splash in index.html. */
const FADE_MS = 320;

let dismissed = false;

/**
 * Fade the boot splash out and remove it from the DOM.
 *
 * Safe to call more than once — later calls are no-ops, so it can live in an
 * effect that re-runs.
 */
export function dismissBootSplash(): void {
  if (dismissed) return;
  dismissed = true;

  if (window.__bootStallTimer !== undefined) {
    clearTimeout(window.__bootStallTimer);
    window.__bootStallTimer = undefined;
  }

  const el = document.getElementById("boot-splash");
  if (!el) return;

  const elapsed = Date.now() - (window.__bootAt ?? Date.now());
  const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

  setTimeout(() => {
    el.classList.add("boot-leaving");

    // transitionend is the accurate signal, but it never fires when the
    // transition is disabled (reduced motion) — so back it with a timer.
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      el.remove();
    };

    el.addEventListener("transitionend", remove, { once: true });
    setTimeout(remove, FADE_MS + 80);
  }, wait);
}
