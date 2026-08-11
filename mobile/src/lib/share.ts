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
