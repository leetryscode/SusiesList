/** Public App Store listing (live since 2026-08-30, ascAppId 6804354294),
 * shared by both the "share the app" and "share a family's list" actions so
 * a recipient without the app has somewhere to install it from. `null` would
 * mean "no link yet"; lib/share.ts handles that by omitting the url rather
 * than sharing a broken one. */
export const APP_SHARE_URL: string | null =
  "https://apps.apple.com/app/id6804354294";
