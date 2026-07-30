/**
 * The Borobudur stupa mark — stepped terraces, bell dome, spire.
 *
 * Animated by the `.stupa-part` rule in index.css: a bright pass climbs the
 * monument base to spire over a ghosted silhouette that never disappears.
 *
 * The same geometry is inlined in index.html for the boot splash, because raw
 * HTML is the only thing that can paint before React mounts. Edit both together.
 */

interface StupaMarkProps {
  /** Rendered size in px (the mark is square). */
  size?: number;
  className?: string;
}

export default function StupaMark({ size = 64, className }: StupaMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
    >
      <polygon className="stupa-part" style={{ animationDelay: "0ms" }} points="6,58 58,58 55,50 9,50" />
      <polygon className="stupa-part" style={{ animationDelay: "110ms" }} points="11,49 53,49 50,41.5 14,41.5" />
      <polygon className="stupa-part" style={{ animationDelay: "220ms" }} points="16,40.5 48,40.5 46,34 18,34" />
      <path className="stupa-part" style={{ animationDelay: "330ms" }} d="M21 33 C21 19.5 43 19.5 43 33 Z" />
      <rect className="stupa-part" style={{ animationDelay: "440ms" }} x="30.5" y="10" width="3" height="13" rx="1.5" />
    </svg>
  );
}
