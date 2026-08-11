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

/** Shares an invite to one specific family via the custom-scheme deep link
 * (SPEC.md §7/§13) - already fully wired up through join/[code].tsx and the
 * pending-invite flow, no new infrastructure needed here. The code is also
 * spelled out in the message as a fallback for a recipient who doesn't have
 * the app installed yet and lands on the manual "Enter your family code"
 * screen instead of following the link. */
export async function shareFamily(
  subjectName: string,
  inviteCode: string
): Promise<void> {
  const deepLink = `susieslist://join/${encodeURIComponent(inviteCode)}`;
  const message = `Come add to ${subjectName}'s list! Tap this link, or enter code ${inviteCode} in the app: ${deepLink}`;
  try {
    await Share.share({ message, url: deepLink });
  } catch {
    // User dismissed the share sheet or the platform share failed silently -
    // nothing for the app to recover from.
  }
}
