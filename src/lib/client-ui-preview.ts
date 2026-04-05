/**
 * Gate for static / demo client surfaces (Estate welcome, track previews,
 * `/partner/pm-preview`, etc.).
 * Enable on deployed envs with ESTATE_UI_PREVIEW or CLIENT_TRACK_PREVIEW.
 */
export function allowClientUiPreview(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ESTATE_UI_PREVIEW === "true" ||
    process.env.CLIENT_TRACK_PREVIEW === "true"
  );
}
