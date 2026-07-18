// lib/tokens.js
// RULE: shadow is reserved for two cases only.
// 1. overlay  — element floats above other content and disappears (dropdown, toast, typeahead)
// 2. interactive — element is clickable; resting + hover shadow signals it will respond
// Everything else is static. Static gets border.default and zero shadow. No exceptions,
// no eyeballing per component. If it doesn't overlay and doesn't click, it doesn't float.

export const radius = {
  sm: 8,    // inputs, small buttons, pills
  md: 12,   // nav items, standard buttons, typeahead/dropdown overlays
  lg: 16,   // cards, panels, search bar
  xl: 20,   // hero-level feature tiles (valueCard)
};

export const elevation = {
  // static content: no shadow, ever. Use border.default instead.
  overlay:  "0 12px 32px rgba(0,0,0,0.14)",   // dropdowns, typeahead, toasts
  float:    "0 12px 40px rgba(0,0,0,0.25)",   // the hero search bar only
  interactiveResting: "0 1px 3px rgba(0,0,0,0.06)",
  interactiveHover:   "0 10px 30px rgba(0,0,0,0.12)",
};

export const border = {
  default: "1px solid #E5E7EB",
};

// Consolidated color palette — the single source of truth. ~55 raw hex values
// across the app collapse into this set: a neutral foundation + five hues
// (brand, price, success, danger, counter), each with at most base / soft-bg /
// strong-text. No minor variations. Excluded on purpose: the RoomIcon SVG
// illustration colors, and the HomeSuitely (?home=v2) draft's own palette.
export const color = {
  // neutral foundation
  ink:         "#1A1F2B", // strong text
  muted:       "#6B7280", // secondary text
  faint:       "#9CA3AF", // tertiary / placeholder text
  line:        "#E5E7EB", // borders, dividers
  surface:     "#FFFFFF", // cards, panels
  surfaceAlt:  "#F4F5F7", // page / section background
  dark:        "#0F172A", // navy dark sections (footer, for-hotels strip)
  onDark:      "#FFFFFF", // text on dark
  onDarkMuted: "#94A3B8", // muted text on dark
  onBrand:     "#0A0F1E", // dark text on amber buttons

  // brand + four semantic hues
  brand:      "#F59E0B", brandText: "#B45309", brandSoft: "#FEF3E2", // amber
  price:      "#0F766E",                                            // teal
  success:    "#16A34A", successSoft: "#DCFCE7",                    // green
  danger:     "#DC2626", dangerSoft:  "#FEE2E2",                    // red
  counter:    "#7C3AED", counterSoft: "#EDE9FE",                    // purple
};
