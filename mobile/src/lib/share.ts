import { Share } from "react-native";

import { APP_SHARE_URL } from "../config";

const SHARE_MESSAGE = "Come add to Susie's list!";

/** Opens the native share sheet. Degrades gracefully when APP_SHARE_URL
 * isn't set yet - shares the message alone rather than a broken/empty link,
 * and swallows share-sheet dismissal so it never surfaces as an error. */
export async function shareApp(): Promise<void> {
  try {
    await Share.share(
      APP_SHARE_URL
        ? { message: SHARE_MESSAGE, url: APP_SHARE_URL }
        : { message: SHARE_MESSAGE }
    );
  } catch {
    // User dismissed the share sheet or the platform share failed silently -
    // nothing for the app to recover from.
  }
}

/** Shares an invite to one specific family via the Universal Link
 * (SPEC.md §7/§13/§18) - already fully wired up through join/[code].tsx and
 * the pending-invite flow, no new app-side infrastructure needed here. Uses
 * the https:// link, not the susieslist:// custom scheme: an https link
 * renders as a real tappable link in Mail/Messages (custom schemes don't),
 * opens the app directly for a recipient who already has it installed (via
 * the associatedDomains entitlement + the AASA file served from
 * leetryscode.github.io), and falls back to a real, friendly webpage
 * instead of doing nothing for a recipient who doesn't have the app yet.
 * The code is still spelled out too, since even with Universal Links there's
 * no deferred deep linking - a link tapped before install doesn't survive
 * the install, so the code is still what gets typed in after. */
export async function shareFamily(
  subjectName: string,
  inviteCode: string
): Promise<void> {
  const inviteLink = `https://leetryscode.github.io/join/${encodeURIComponent(inviteCode)}`;
  const message = `Come add to ${subjectName}'s list! Get Susie's List, then enter code ${inviteCode} to join: ${inviteLink}`;
  try {
    await Share.share({ message, url: inviteLink });
  } catch {
    // User dismissed the share sheet or the platform share failed silently -
    // nothing for the app to recover from.
  }
}
