import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "susies-list/active-family-id";

export async function getActiveFamilyId(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function setActiveFamilyId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEY, id);
}

export async function clearActiveFamilyId(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
