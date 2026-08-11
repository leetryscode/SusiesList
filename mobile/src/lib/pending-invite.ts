import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "susies-list/pending-invite-code";

export async function getPendingInviteCode(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function setPendingInviteCode(code: string): Promise<void> {
  await AsyncStorage.setItem(KEY, code);
}

export async function clearPendingInviteCode(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
