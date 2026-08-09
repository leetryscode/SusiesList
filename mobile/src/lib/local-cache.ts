import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Category } from "./categories";
import type { Item } from "./items";

export type CachedFamilyData = {
  categories: Category[];
  items: Item[];
  authorNames: Record<string, string>;
};

function cacheKey(familyId: string) {
  return `susies-list/cache/${familyId}`;
}

export async function readCachedFamilyData(
  familyId: string
): Promise<CachedFamilyData | null> {
  const raw = await AsyncStorage.getItem(cacheKey(familyId));
  return raw ? (JSON.parse(raw) as CachedFamilyData) : null;
}

export async function writeCachedFamilyData(
  familyId: string,
  data: CachedFamilyData
): Promise<void> {
  await AsyncStorage.setItem(cacheKey(familyId), JSON.stringify(data));
}
