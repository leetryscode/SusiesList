import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "susies-list/pending-invite-code";

export async function setPendingInviteCode(code: string) {
  await AsyncStorage.setItem(KEY, code);
}

export async function consumePendingInviteCode(): Promise<string | null> {
  const code = await AsyncStorage.getItem(KEY);
  if (code) {
    await AsyncStorage.removeItem(KEY);
  }
  return code;
}
