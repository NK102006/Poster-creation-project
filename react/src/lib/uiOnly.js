/** UI-only mode: work on frontend without a running backend. */
export const isUiOnly =
  String(import.meta.env.VITE_UI_ONLY || '').toLowerCase() === 'true';
