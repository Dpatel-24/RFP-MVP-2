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
