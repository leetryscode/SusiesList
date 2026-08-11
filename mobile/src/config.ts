/** Install link shared via the native share sheet. Placeholder until step 7
 * (EAS Build -> TestFlight/App Store) produces a real one - swap this single
 * value when it exists, nothing else needs to change. `null` means "no link
 * yet"; lib/share.ts handles that by omitting the url rather than sharing a
 * broken one. */
export const APP_SHARE_URL: string | null = null;
