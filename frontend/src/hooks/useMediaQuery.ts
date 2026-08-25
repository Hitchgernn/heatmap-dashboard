import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query from React.
 *
 * Used for layout decisions that CSS alone can't make — the sidebar becomes an
 * overlay drawer below `lg`, which changes markup and focus behavior, not just
 * styling. Anything expressible in pure CSS should stay in Tailwind classes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Tailwind's `lg` breakpoint — below it the shell switches to drawer navigation. */
export const BELOW_LG = "(max-width: 1023px)";
