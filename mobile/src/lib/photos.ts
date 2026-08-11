import { decode } from "base64-arraybuffer";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS } from "react-native";

import { supabase } from "./supabase";

const BUCKET = "recipe-photos";

export type PickedPhoto = {
  base64: string;
  mimeType: string;
};

function toPickedPhotos(result: ImagePicker.ImagePickerResult): PickedPhoto[] {
  if (result.canceled) return [];
  return result.assets
    .filter((asset) => !!asset.base64)
    .map((asset) => ({
      base64: asset.base64 as string,
      mimeType: asset.mimeType ?? "image/jpeg",
    }));
}

async function takePhoto(): Promise<PickedPhoto[]> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") return [];
  // The camera only ever captures one photo at a time - multi-select is a
  // library-only concept - so this keeps allowsEditing (cropping), which is
  // mutually exclusive with allowsMultipleSelection.
  return toPickedPhotos(
    await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.6,
      allowsEditing: true,
    })
  );
}

async function chooseFromLibrary(): Promise<PickedPhoto[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return [];
  return toPickedPhotos(
    await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.6,
      allowsMultipleSelection: true,
    })
  );
}

/** Opens "Take Photo" / "Choose from Library" / "Cancel" - the same
 * ActionSheetIOS picker-of-one pattern already used for category removal.
 * Resolves an empty array if the user cancels or denies permission at any
 * point. Choosing from the library can return more than one photo; taking a
 * photo always returns at most one. Callers can call this repeatedly to add
 * more photos to what they already have. */
export function pickRecipePhotos(): Promise<PickedPhoto[]> {
  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Take Photo", "Choose from Library", "Cancel"],
        cancelButtonIndex: 2,
      },
      (buttonIndex) => {
        if (buttonIndex === 2) {
          resolve([]);
          return;
        }
        const pick = buttonIndex === 0 ? takePhoto() : chooseFromLibrary();
        pick.then(resolve);
      }
    );
  });
}

/** Uploads to the private recipe-photos bucket under a random filename
 * (see SPEC.md §17 for why there's no per-item folder). Returns the stored
 * object path - not a URL, since the bucket is private. */
export async function uploadRecipePhoto(
  familyId: string,
  photo: PickedPhoto
): Promise<string> {
  const extension = photo.mimeType.split("/")[1] ?? "jpg";
  const path = `${familyId}/${Crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(photo.base64), { contentType: photo.mimeType });
  if (error) throw error;

  return path;
}

export async function uploadRecipePhotos(
  familyId: string,
  photos: PickedPhoto[]
): Promise<string[]> {
  return Promise.all(photos.map((photo) => uploadRecipePhoto(familyId, photo)));
}

/** Null on failure (e.g. offline, or the object no longer exists) rather
 * than throwing - the detail screen just shows no photo in that case. */
export async function getRecipePhotoUrl(
  photoPath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(photoPath, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

/** Returns a { path: url } map, skipping any path whose signed URL failed
 * to generate rather than failing the whole batch. */
export async function getRecipePhotoUrls(
  paths: string[]
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    paths.map(async (path) => [path, await getRecipePhotoUrl(path)] as const)
  );
  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] => entry[1] !== null)
  );
}
