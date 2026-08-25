---
name: Borobudur Aggregated Heatmap Dashboard
description: A calibrated field instrument for reading visitor density at Borobudur — gray chassis, monospace readings, color reserved for the measurement.
colors:
  signal-red: "#dc2626"
  caution-amber: "#f59e0b"
  clear-green: "#16a34a"
  heat-lime: "#84cc16"
  heat-yellow: "#facc15"
  stupa-amber: "#c9781f"
  stupa-amber-night: "#e8973a"
  instrument-ink: "#111827"
  body-ink: "#1f2937"
  muted-ink: "#6b7280"
  muted-ink-night: "#9ca3af"
  bench-paper: "#f9fafb"
  panel-white: "#ffffff"
  night-chassis: "#030712"
  hairline: "#e5e7eb"
  hairline-night: "#1f2937"
  tile-void: "#e5e7eb"
  tile-void-night: "#1f2937"
  select-wash: "#eff6ff"
  badge-high-bg: "#fee2e2"
  badge-high-ink: "#b91c1c"
  badge-medium-bg: "#fef3c7"
  badge-medium-ink: "#b45309"
  badge-low-bg: "#d1fae5"
  badge-low-ink: "#047857"
typography:
  display:
    fontFamily: "Instrument Serif, ui-serif, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "normal"
  headline:
    fontFamily: "Instrument Serif, ui-serif, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1.15
  title:
    fontFamily: "Instrument Serif, ui-serif, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  metric:
    fontFamily: "Fira Code, ui-monospace, SFMono-Regular, monospace"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.15
    fontFeature: "tabular-nums"
  label:
    fontFamily: "Fira Code, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.05em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.instrument-ink}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "#374151"
  button-page:
    backgroundColor: "transparent"
    textColor: "#4b5563"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  pill-active:
    backgroundColor: "{colors.instrument-ink}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
  pill-idle:
    backgroundColor: "transparent"
    textColor: "#4b5563"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
  pill-idle-hover:
    backgroundColor: "#f3f4f6"
    textColor: "{colors.instrument-ink}"
  card-metric:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.instrument-ink}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  panel:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.body-ink}"
    rounded: "{rounded.lg}"
    padding: "14px 20px"
  input-text:
    backgroundColor: "{colors.bench-paper}"
    textColor: "#374151"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    typography: "{typography.body}"
  nav-item-active:
    backgroundColor: "{colors.instrument-ink}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  status-pill:
    backgroundColor: "{colors.panel-white}"
    textColor: "#4b5563"
    rounded: "{rounded.full}"
    padding: "4px 12px"
    typography: "{typography.label}"
  badge-tier-high:
    backgroundColor: "{colors.badge-high-bg}"
    textColor: "{colors.badge-high-ink}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-tier-medium:
    backgroundColor: "{colors.badge-medium-bg}"
    textColor: "{colors.badge-medium-ink}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-tier-low:
    backgroundColor: "{colors.badge-low-bg}"
    textColor: "{colors.badge-low-ink}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  modal-panel:
    backgroundColor: "{colors.panel-white}"
    rounded: "{rounded.xl}"
    width: "672px"
---

# Design System: Borobudur Aggregated Heatmap Dashboard

## Overview

**Creative North Star: "The Field Instrument"**

This is a calibrated measuring device, not a console and not a brochure. The
chassis is achromatic — paper gray in daylight, near-black at night — and every
control on it is gray, white, or ink. The saturated color on screen is never
decoration and never brand: it is the reading. Red, amber, and green mean
crowd density and nothing else, and they appear on exactly the elements that
carry a measurement: the heat ramp, the tier dots, the badges, the map pins,
the accent bar on a summary card. Everything else steps back so the map can be
read at a glance.

The typography carries the instrument metaphor by splitting labor three ways.
Instrument Serif signs the object — the wordmark, page titles, panel headings,
and named values like the busiest area. Fira Code carries every quantity,
status, ID, and small uppercase label, so numbers align and a reading always
looks like a reading. DM Sans handles anything you read as a sentence and is
the document default, so most elements name no font at all. The serif keeps the
dashboard from feeling like a generic admin panel; the mono keeps it from
feeling casual about its data.

Depth is nearly absent by design. Panels sit flat on the chassis, separated by
1px hairlines rather than lift. A shadow appears only when something genuinely
floats above the map — the density legend, a popover, a pin, the settings
modal. The one warm note in the entire system is the stupa mark
(`stupa-amber` #c9781f), a five-part silhouette whose terraces light base to
spire on a 1.5s loop; it is the boot splash, the favicon, and the refreshing
indicator, so a poll in progress and the app starting up read as the same
object breathing.

**Key Characteristics:**

- Achromatic chassis; saturated color only where a measurement lives.
- Three fonts, three non-overlapping jobs (serif signs, mono measures, sans explains).
- Flat surfaces, hairline separation, shadow reserved for things above the map.
- Full ink inversion for active state — never a tint, never a highlight color.
- The basemap is theme-independent: light and dark change the chassis, never the place.
- One warm accent, used once: the stupa mark.

## Colors

An achromatic instrument chassis carrying a five-stop density ramp; the palette
has no brand hue competing with the data.

### Primary

- **Instrument Ink** (#111827): the system's only "solid" color. It fills every
  active state — selected nav item, selected time-window pill, selected data
  source, primary buttons, the avatar chip — and inverts to white-on-ink in
  dark mode. It is also the dark-mode panel surface, which is deliberate: the
  same value reads as "the active thing" in daylight and "the surface" at
  night.
- **Body Ink** (#1f2937): default text color in light mode, and the dark-mode
  hairline. Never used as a fill for interactive elements.

### Secondary

The **density scale** — the only saturated family in the system, shared by the
heat layer, the tier dots, the badges, the map pins, and the charts, so all five
always agree about what "crowded" looks like.

- **Signal Red** (#dc2626): high density. Top stop of the heat ramp, high-tier
  pins and dots, the *most crowded area* card accent.
- **Caution Amber** (#f59e0b): medium density. Fourth heat stop, medium-tier
  markers.
- **Clear Green** (#16a34a): low density / nominal. Bottom heat stop, low-tier
  markers, the *active visitors* card accent, and the `live` status dot
  (#059669, matching the standalone layer indicator).
- **Heat Lime** (#84cc16) and **Heat Yellow** (#facc15): interstitial ramp stops
  at 0.4 and 0.6. They exist only inside the gradient — never as a UI color.

The ramp is fixed at five normalized stops (0.2 → 1.0) and mirrored as a CSS
`linear-gradient` for the legend bar, so the legend and the layer cannot drift.

### Tertiary

- **Stupa Amber** (#c9781f, night #e8973a): the mark alone. Drawn from the
  middle of the density ramp so the identity sits inside the data palette rather
  than beside it. It appears in the boot splash, the favicon, the refreshing
  pill, and the loading state — nowhere else.

### Neutral

- **Bench Paper** (#f9fafb): light chassis. Also the pre-mount `body`
  background and the boot-splash ground, so the first painted frame already
  matches the app.
- **Panel White** (#ffffff): every card, panel, header, sidebar, table, and
  floating control in light mode.
- **Night Chassis** (#030712): dark chassis, matched by the same pre-mount rule.
  Dark panels sit one step up at Instrument Ink (#111827).
- **Hairline** (#e5e7eb light / #1f2937 night): every border, divider, and table
  rule. This is the system's real edge — see Elevation & Depth.
- **Muted Ink** (#6b7280 light / #9ca3af night): mono eyebrow labels, table
  column heads, secondary IDs, empty-state messages, and disabled nav items.
  The pair inverts across themes — the lighter value is the *dark*-mode value.
  Applied the other way round it measures 2.54:1 on paper and 3.67:1 on ink,
  failing AA in both.
- **Tile Void** (#e5e7eb light / #1f2937 night): the color behind Leaflet tiles
  before they load, so the map area never flashes a color the chassis doesn't
  own.
- **Select Wash** (#eff6ff, night `blue-950/40`): the selected hotspot table
  row. The one blue in the system; it marks *your* selection, which is neither a
  measurement nor a state of the site.

### Named Rules

**The Reading Rule.** Saturated color is a measurement. If an element is not
reporting density, it is gray, ink, or white. A new accent color needs a new
kind of measurement to justify it.

**The Inversion Rule.** Active state is a full ink inversion — `#111827` ground
with white text in light mode, white ground with `#111827` text in dark. Never a
tinted background, never a colored border, never an underline.

**The Inverted Label Rule.** Muted labels darken in light mode and lighten in
dark: `text-gray-500 dark:text-gray-400`. Writing the pair the intuitive way
round fails WCAG AA in both themes at once, because each value is only legible
against the *opposite* ground.

**The One Ember Rule.** Stupa Amber appears once per screen at most, and only on
the mark. It is identity, not accent; it never becomes a button, a link, or a
chart series.

## Typography

**Display Font:** Instrument Serif (with `ui-serif`, Georgia, serif)
**Body Font:** DM Sans (with `ui-sans-serif`, system-ui, sans-serif)
**Label/Mono Font:** Fira Code (with `ui-monospace`, SFMono-Regular, monospace)

**Character:** A humanist serif signing a technical instrument. Instrument Serif
is set at its natural weight with no tracking — light, high-contrast, slightly
literary — and it lands only on names and titles, so the interface reads as a
*record of a place* rather than a generic dashboard. Fira Code does the opposite
job: every number, status, and eyebrow label is monospaced and tabular, so
figures align down a column and a changing value doesn't shift its neighbors.
DM Sans sits between them, unremarked, carrying sentences.

### Hierarchy

- **Display** (400, 3rem–3.75rem / `text-5xl`–`text-6xl`, 1.1): the login
  wordmark only. Paired with an italic serif subtitle at `text-2xl`–`text-3xl`.
- **Headline** (400, 1.875rem / `text-3xl`, 1.15): the value inside a summary
  card when it is a *name* rather than a number (e.g. the busiest area). Numbers
  at the same size switch to Metric.
- **Title** (400, 1.25rem / `text-xl`): the page title in the top header. Panel
  and section headings step down to `text-lg`; the sidebar wordmark sits at
  `text-2xl`.
- **Body** (400, 0.875rem / `text-sm`, 1.5): every sentence, nav label, form
  label, and control label. Secondary and hint text drops to `text-xs` in
  `muted-ink`.
- **Metric** (600, 1.875rem / `text-3xl`, `tabular-nums`): the number inside a
  summary card. In tables and inline readings it drops to `text-sm`, still mono
  and still tabular.
- **Label** (600, 0.6875rem / `text-[11px]`, uppercase, `tracking-wider`): mono
  eyebrow labels above card values, table column heads, the sidebar tagline, the
  collapse control, and status-pill text. The login page uses a wider
  `0.2em` tracking for its single uppercase eyebrow.

### Named Rules

**The Three-Jobs Rule.** A number or a status → mono. A prominent heading or a
proper name → display. Everything else → no font class at all, because DM Sans
is already the document default. If you find yourself adding `font-sans`, you
are adding nothing.

**The Tabular Number Rule.** Every figure that can change while the user is
looking at it carries `tabular-nums`. Polls run every 30s; a value that
reflows its own column on update is a defect.

## Layout

A fixed application shell, not a scrolling page. The frame is a 256px (`w-64`)
sidebar rail beside a column holding a 64px (`h-16`) top header over the content
area; only the content area scrolls. The rail stays mounted and animates its
width between `16rem` and `0` over 300ms `ease-in-out`, with its inner content
held at a fixed 256px width and clipped, so labels never reflow mid-collapse.

Content sits on a 24px page inset (`p-6`) with a 20px vertical rhythm
(`space-y-5`) between major blocks. The spacing scale in use is 4 / 8 / 12 / 16
/ 20 / 24px; panels are padded 16px vertical by 20px horizontal, headers and
footers of panels at 12–14px vertical.

**The Dashboard grid** is the system's signature spatial decision: a two-column
`lg` grid of `minmax(0,720px)` and `minmax(0,1fr)`, aligned to `items-start`.
The map is a square capped at 720px; the right column is flexible. The
consequence is deliberate — when the sidebar collapses, the **map holds its size
and the right column grows** into the freed width, rather than the map
stretching and the operator losing their spatial reference. Inside that right
column, two charts sit side by side at `xl` (`xl:grid-cols-2`) and stack below
it, with the hotspot table full-width beneath.

Everything collapses to a single column below `lg`. The login page splits 45% /
55% at `lg` and hides its branding panel entirely below that, promoting a
compact stacked wordmark above the form.

Map overlays are positioned inside the map frame at a 12px inset (`top-3`,
`left-3`, `right-3`, `bottom-3`) on `z-[600]`: time filter top-left, layer
controls and the hotspot detail card top-right, density legend bottom-left. When
the sidebar is collapsed the top-left control shifts to `left-14` to clear the
floating show-sidebar button.

### Named Rules

**The Held Map Rule.** The map is capped, not fluid. Freed width goes to the
data column. An operator's mental map of the temple must not resize under them.

**The Static Panel Rule.** The hotspot table always renders exactly 4 row slots,
padding short pages with blank rows that mirror the two-line cell structure. A
30s poll must never change the height of the page.

## Elevation & Depth

**Flat by default; depth means distance from the map.** Surfaces do not float.
Separation is done by a 1px hairline (`#e5e7eb` light, `#1f2937` night) plus a
tonal step between chassis and panel — paper→white in daylight, near-black→ink
at night. Panels carry `shadow-sm` and nothing more; it reads as a seated edge,
not lift.

A real shadow appears only when an element is genuinely *above* the map or the
page, and its size tracks how transient the element is.

### Shadow Vocabulary

- **Seated** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)` — `shadow-sm`): cards,
  panels, the time-filter group, standalone status indicators. Default for
  anything sitting on the chassis.
- **Floating** (`shadow-md`, paired with `backdrop-blur` and a 95% opaque
  ground): the density legend over the map. It must stay readable over both OSM
  tiles and satellite imagery.
- **Transient** (`shadow-lg`): the custom time-window popover and other
  short-lived overlays.
- **Modal** (`shadow-2xl`): the settings dialog, over a `bg-gray-900/40`
  (`black/60` at night) `backdrop-blur-sm` scrim.
- **Map pin** (`filter: drop-shadow(0 2px 3px rgba(0,0,0,.35))`): the only
  hard shadow in the system. Pins are physically on the map and need to
  separate from arbitrary imagery, so this one is stronger than everything else
  on purpose.
- **Hotspot tooltip** (`box-shadow: 0 2px 6px rgba(0,0,0,.12)`, arrow removed):
  a plain white chip, never a Leaflet-default balloon.

### Named Rules

**The Flat-Until-Floating Rule.** If an element is part of the page, it gets a
hairline and at most `shadow-sm`. If it sits over the map, it earns a shadow
sized to how long it will be there. Nothing lifts on hover.

## Shapes

Rectilinear, with radius stepped by element size — the larger and more
container-like a thing is, the softer its corners.

- **4px** (`rounded-sm`): legend swatches, skeleton blocks.
- **6px** (`rounded-md`): pills, segmented-control segments, pagination buttons,
  primary buttons, small inputs, the hotspot tooltip chip.
- **8px** (`rounded-lg`): nav items, text inputs, floating control groups, the
  segmented-control container, the density legend, alert boxes.
- **12px** (`rounded-xl`): every card, panel, table container, and the map frame.
- **16px** (`rounded-2xl`): the settings modal.
- **Full** (`rounded-full`): status pills, tier badges, the avatar chip, and
  every density dot (8–10px).

Borders are always exactly 1px and always a hairline value; there are no 2px
borders, no double rules, and no dashed strokes anywhere in the UI. Circular
geometry belongs to the map: tier dots, avatar, status dots, and the translucent
cluster extent circle.

The one non-rectilinear form in the system is the **stupa silhouette** — three
stacked trapezoid terraces, a bell dome drawn as a single cubic curve, and a
rounded spire, on a 64×64 grid. It also supplies the teardrop map pin's
counterpoint: a 24×32 pin with a 4.2px white core and a 2px white stroke.

### Named Rules

**The Radius-By-Size Rule.** Control 6px, input and nav 8px, panel 12px, modal
16px, anything pill-shaped fully round. A new component inherits the radius of
its size class rather than inventing one.

## Components

### Buttons

- **Shape:** Softly squared (6px), or 8px when the button is form-sized.
- **Primary:** Instrument Ink ground with white text, 10px × 16px padding,
  `text-sm font-medium`. Inverts to white-on-ink in dark mode.
- **Hover / Focus:** `hover:bg-gray-700` (`gray-200` in dark), `transition-colors`
  only — no transform, no shadow change. Focus is a 2px `gray-400`
  `focus-visible` ring with `outline-none`; the login page uses a 2px offset
  outline instead.
- **Disabled:** `opacity-40` with `cursor-not-allowed`. No color change.
- **Ghost / pagination:** transparent ground, hairline border, `gray-600` text
  darkening to `gray-900` on hover, 4px × 10px padding at `text-xs`.

### Segmented controls (time window, data source, table filter)

The system's dominant control. A hairline container (8px radius, 2–4px inner
padding, `shadow-sm`; `bg-gray-50` for the compact variants) holding pill
segments at 6px radius.

- **Active segment:** full ink inversion — `bg-gray-900 text-white`, reversed in
  dark. State is carried by `aria-pressed`.
- **Idle segment:** `gray-600` text on transparent, hovering to `gray-100`
  ground and `gray-900` text.
- **Sizes:** 12px × 4px padding at `text-sm` for the time window, 10px × 4px at
  `text-xs` for the source toggle and table filter.
- The trailing **Custom** segment opens a `shadow-lg` popover holding a mono
  tabular number field, a unit select, and an ink Apply button; invalid input
  switches the field border to `red-400` and disables Apply.

### Cards / Containers

- **Corner Style:** 12px (`rounded-xl`).
- **Background:** Panel White, or Instrument Ink at night.
- **Shadow Strategy:** `Seated` only (see Elevation & Depth).
- **Border:** 1px hairline, on all four sides.
- **Internal Padding:** 16px vertical / 20px horizontal. Panels with a header or
  footer separate them with a hairline at 12–14px vertical padding.
- **Summary card:** carries a 4px full-height accent bar flush to the left edge
  (`absolute inset-y-0 left-0 w-1`), colored from the density scale by meaning —
  Clear Green for active visitors, Instrument Ink for total points, Signal Red
  for the busiest area. Above the value sits a mono uppercase eyebrow; below it,
  an optional `text-xs` hint. First load renders a `h-8 w-24` pulsing skeleton
  in place of the value, never a spinner.

### Inputs / Fields

- **Style:** 8px radius, 1px hairline, `bg-gray-50` ground for in-chrome inputs
  and white for form inputs, 8–10px vertical padding, `text-sm`.
- **Focus:** ground lifts to white, border steps one shade darker, and a 2px
  ring appears (`gray-200` in chrome, `gray-900/20` on the login form). Never a
  colored glow.
- **Error:** border switches to `red-400` / `red-500` with `aria-invalid`; the
  message renders in a separate `red-50` alert box with a `red-200` border and
  `role="alert"`.
- **Numeric fields** are mono and `tabular-nums`.

### Navigation

The sidebar rail opens with a serif wordmark ("Borobudur", `text-2xl`) over a
mono uppercase tagline in `muted-ink`, then a mono uppercase collapse control.
Nav items are 8px-radius rows at 12px × 10px padding, `text-sm font-medium`,
with an 18px 2px-stroke `currentColor` icon at 12px gap. Active is full ink
inversion with `aria-current="page"`; idle is `gray-600` hovering to `gray-100`
ground; disabled is `gray-300` with `cursor-not-allowed` and a "coming soon"
title. The rail closes with a bottom hairline section holding a fully round ink
avatar chip, name and role, and a 36px square icon button that opens Settings.

Section names — Dashboard, Heatmap, Hotspots, Mock Generator — are English in
both locales by product rule.

### Status pill

Fully round, hairline border, white ground, mono `text-xs`. Three states:
`live` shows an emerald dot, `error` a red dot with `gray-400` for
`refreshing` — except that refreshing swaps the dot for a 14px animated
**stupa mark**, so a poll in flight and the boot splash read as the same object.

### Tier badge

Fully round, 10px × 2px padding, mono `text-xs font-medium`, tinted ground with
matching dark ink: red-100/red-700 (High), amber-100/amber-700 (Medium),
emerald-100/emerald-700 (Low), each with a `950/50` ground and `300` ink at
night. Tier colors, labels, and badge classes all resolve from a single
`TIER_META` map so the map markers, the table, the legend, and both charts can
never disagree.

### Data table

Hairline-ruled, never zebra-striped. Column heads are mono 11px uppercase
`tracking-wider` in `muted-ink` over a hairline; rows separate with
`border-gray-50`; numeric columns are right-aligned, mono, and tabular. A row
carries a two-line primary cell — name in `font-medium`, mono `ID: #…` beneath
in `muted-ink`. Hover washes `gray-50`; selection washes `select-wash` and syncs
with the map markers. Loading and empty states occupy the first row slot with
the rest padded (see The Static Panel Rule).

### Map overlays

The basemap is theme-independent — light and dark change the chassis, never the
place. Leaflet's own chrome is restyled to the system: white zoom controls with
hairline dividers, an 80%-white attribution bar, white popups at 8px radius, and
hotspot tooltips as plain 6px white chips with the arrow suppressed.

Hotspots render as **teardrop pins** (28px, 34px when selected) filled from the
density scale, stroked 2px white with a 4.2px white core, anchored so the tip
sits on the exact centroid — plus a translucent extent circle at the cluster's
real radius in metres (`opacity .4 / fillOpacity .08`, rising to `.9 / .18` when
selected). No permanent labels; the name appears in a detail card on click.

### The Stupa Mark (signature)

Five parts on a 64×64 grid — three stacked terraces, a bell dome, a spire —
filled `stupa-amber` and held at `0.16` opacity, with a bright pass climbing
base to spire on a 1500ms `cubic-bezier(0.33, 0.9, 0.35, 1)` infinite loop,
staggered 110ms per part. It is the favicon, the boot splash, the loading state,
and the refreshing pill.

The geometry is duplicated in `index.html` because raw HTML is the only thing
that paints before React mounts — **edit both together.** `transform-box:
fill-box` is required, or SVG children resolve `transform-origin` against the
whole viewport box and drift.

### Motion

Motion is entrance and state only; nothing loops except the mark.

- **Page change** (`page-enter`, 260ms `ease-out`): fade up 6px. The wrapper is
  keyed by page so React remounts and replays it.
- **Modal** (160ms backdrop fade; 200ms panel at `cubic-bezier(0.16, 1, 0.3, 1)`
  from `scale(0.96) translateY(8px)`).
- **Login** (500ms brand panel from `translateX(-24px)`; 400ms form from
  `translateY(12px)` with a 120ms delay and `both` fill).
- **Sidebar** (300ms `ease-in-out` width, 200ms inner opacity).
- **Aggregating pill** (200ms fade down 6px) while a timelapse frame is in
  flight.
- **Reduced motion:** a blanket `0.01ms` override on all animations and
  transitions, plus an explicit rule holding the stupa mark solid at `0.9`
  opacity — the blanket rule alone would freeze it on its `16%`-opacity first
  frame.

## Do's and Don'ts

### Do:

- **Do** reserve saturated color for measurements. Density red/amber/green
  (#dc2626 / #f59e0b / #16a34a) mean crowding; everything else is gray, ink, or
  white.
- **Do** express active state as a full ink inversion (`#111827` + white,
  reversed at night), matching every existing pill, nav item, and button.
- **Do** resolve tier color, label, and badge styling from `TIER_META` so the
  map, table, legend, and charts stay in agreement.
- **Do** set every changeable figure in Fira Code with `tabular-nums`; polls
  land every 30s.
- **Do** write muted labels as `text-gray-500 dark:text-gray-400`, never the
  reverse, and lift them to `gray-600` on the `white/95` panels floating over
  the map, where the translucent ground costs about half a contrast point.
- **Do** separate surfaces with a 1px hairline (#e5e7eb / #1f2937) and reserve
  shadow for elements floating over the map.
- **Do** keep panel heights static across a poll — pad short pages with blank
  rows rather than letting the layout reflow.
- **Do** ship both themes and both languages on every new element, and give
  every interactive control a `focus-visible:ring-2 ring-gray-400`.
- **Do** hold the map at its capped size and let the data column absorb freed
  width.
- **Do** edit `StupaMark.tsx` and the `index.html` boot splash together; they
  are one mark rendered twice.

### Don't:

- **Don't** use a gradient as decoration. The density ramp is the only gradient
  in the system, and it is data. No gradient backgrounds, gradient text, or
  gradient buttons.
- **Don't** style, tint, or filter the basemap by theme. The dashboard and the
  DBSCAN notebook must show the same place, and satellite imagery must stay
  true.
- **Don't** promote Stupa Amber (#c9781f) to an accent. It belongs to the mark
  alone — never a button, link, chart series, or border.
- **Don't** introduce a second display or body font, or reach for `font-sans`;
  DM Sans is already the default and the three roles are fixed.
- **Don't** add lift on hover. State changes are color changes
  (`transition-colors`); no `translateY`, no growing shadow.
- **Don't** invent a new radius. Take it from the size class: 6px control, 8px
  input/nav, 12px panel, 16px modal, full for pills.
- **Don't** encode meaning in hue alone — pair every tier color with its text
  label, as the legend, table, and badges already do.
- **Don't** let the map stretch to fill the window at the expense of the data
  column, or let a control float over the map without a shadow to separate it.
