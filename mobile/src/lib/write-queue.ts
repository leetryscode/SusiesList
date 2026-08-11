import AsyncStorage from "@react-native-async-storage/async-storage";

export type PendingWrite =
  | {
      kind: "create";
      itemId: string;
      categoryId: string;
      authorId: string;
      title: string;
      note: string;
      photoPaths: string[];
    }
  | {
      kind: "update";
      itemId: string;
      title: string;
      note: string;
      photoPaths: string[];
    }
  | { kind: "delete"; itemId: string }
  | {
      kind: "create-category";
      categoryId: string;
      familyId: string;
      authorId: string;
      name: string;
      sortOrder: number;
    }
  | { kind: "delete-category"; categoryId: string };

const KEY = "susies-list/pending-writes";

export async function getPendingWrites(): Promise<PendingWrite[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as PendingWrite[]) : [];
}

async function setPendingWrites(writes: PendingWrite[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(writes));
}

export async function enqueueWrite(write: PendingWrite): Promise<void> {
  const writes = await getPendingWrites();
  writes.push(write);
  await setPendingWrites(writes);
}

export async function removeFirstPendingWrite(): Promise<void> {
  const writes = await getPendingWrites();
  writes.shift();
  await setPendingWrites(writes);
}
