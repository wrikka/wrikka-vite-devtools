// scripts/inline-overlay-css.ts replaces the token with the built stylesheet
// (UnoCSS utilities + overlay.css) at build time; dev/typecheck sees the token.
export const overlayCss = '__OVERLAY_CSS_TOKEN__'
