import * as Crypto from "expo-crypto";

import {
  createCategory as remoteCreateCategory,
  listCategories,
} from "./categories";
import {
  createItem as remoteCreateItem,
  deleteItem as remoteDeleteItem,
  getItem as remoteGetItem,
  listItems,
  updateItem as remoteUpdateItem,
  type Item,
} from "./items";
import {
  readCachedFamilyData,
  writeCachedFamilyData,
  type CachedFamilyData,
} from "./local-cache";
import { listDisplayNames } from "./profiles";
import {
  enqueueWrite,
  getPendingWrites,
  removeFirstPendingWrite,
} from "./write-queue";

/** Fetch failures (offline, no signal) look different from a real Postgres/RLS
 * rejection - supabase-js surfaces the former as a generic "Network request
 * failed"-style error with no Postgres error code attached. That's the
 * signal used here to decide "queue and retry" vs "show the user an error".
 * Network failures from postgrest-js arrive as a plain object (not an Error
 * instance) with a `message` field, e.g. "TypeError: Network request failed"
 * - so this checks the message on anything with one, not just Error instances. */
function isNetworkError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return false;
  }
  const message = (error as { message: unknown }).message;
  return typeof message === "string" && /network|fetch/i.test(message);
}

export async function loadCachedFamilyData(
  familyId: string
): Promise<CachedFamilyData | null> {
  return readCachedFamilyData(familyId);
}

export async function refreshFamilyData(
  familyId: string
): Promise<CachedFamilyData> {
  const categories = await listCategories(familyId);
  const items = await listItems(categories.map((c) => c.id));
  const authorNames = await listDisplayNames(items.map((i) => i.created_by));

  const data: CachedFamilyData = { categories, items, authorNames };
  await writeCachedFamilyData(familyId, data);
  return data;
}

async function patchCache(
  familyId: string,
  patch: (data: CachedFamilyData) => CachedFamilyData
): Promise<void> {
  const current = (await readCachedFamilyData(familyId)) ?? {
    categories: [],
    items: [],
    authorNames: {},
  };
  await writeCachedFamilyData(familyId, patch(current));
}

export async function createItemOffline(
  familyId: string,
  categoryId: string,
  authorId: string,
  title: string,
  note: string
): Promise<string | null> {
  const itemId = Crypto.randomUUID();
  const item: Item = {
    id: itemId,
    category_id: categoryId,
    title,
    note: note.length > 0 ? note : null,
    created_by: authorId,
    created_at: new Date().toISOString(),
  };

  await patchCache(familyId, (data) => ({
    ...data,
    items: [...data.items, item],
  }));

  try {
    await remoteCreateItem(itemId, categoryId, authorId, title, note);
  } catch (error) {
    if (!isNetworkError(error)) return (error as Error).message;
    await enqueueWrite({
      kind: "create",
      itemId,
      categoryId,
      authorId,
      title,
      note,
    });
  }
  return null;
}

export async function updateItemOffline(
  familyId: string,
  itemId: string,
  title: string,
  note: string
): Promise<string | null> {
  await patchCache(familyId, (data) => ({
    ...data,
    items: data.items.map((item) =>
      item.id === itemId
        ? { ...item, title, note: note.length > 0 ? note : null }
        : item
    ),
  }));

  try {
    await remoteUpdateItem(itemId, title, note);
  } catch (error) {
    if (!isNetworkError(error)) return (error as Error).message;
    await enqueueWrite({ kind: "update", itemId, title, note });
  }
  return null;
}

export async function deleteItemOffline(
  familyId: string,
  itemId: string
): Promise<string | null> {
  await patchCache(familyId, (data) => ({
    ...data,
    items: data.items.filter((item) => item.id !== itemId),
  }));

  try {
    await remoteDeleteItem(itemId);
  } catch (error) {
    if (!isNetworkError(error)) return (error as Error).message;
    await enqueueWrite({ kind: "delete", itemId });
  }
  return null;
}

export async function createCategoryOffline(
  familyId: string,
  authorId: string,
  name: string
): Promise<string | null> {
  const categoryId = Crypto.randomUUID();
  const current = await readCachedFamilyData(familyId);
  const sortOrder =
    current && current.categories.length > 0
      ? Math.max(...current.categories.map((c) => c.sort_order)) + 1
      : 1;

  await patchCache(familyId, (data) => ({
    ...data,
    categories: [
      ...data.categories,
      { id: categoryId, name, icon: null, sort_order: sortOrder },
    ],
  }));

  try {
    await remoteCreateCategory(categoryId, familyId, authorId, name, sortOrder);
  } catch (error) {
    if (!isNetworkError(error)) return (error as Error).message;
    await enqueueWrite({
      kind: "create-category",
      categoryId,
      familyId,
      authorId,
      name,
      sortOrder,
    });
  }
  return null;
}

/** Processes the pending-write queue in order. Stops at the first write that
 * still looks like a network failure (nothing after it can be trusted to
 * fare better right now) but drops - rather than retries forever - any
 * write that fails for a real reason, since retrying an RLS rejection or a
 * bad request every app focus would never succeed. */
export async function flushPendingWrites(): Promise<void> {
  while (true) {
    const [next] = await getPendingWrites();
    if (!next) return;

    try {
      if (next.kind === "create") {
        await remoteCreateItem(
          next.itemId,
          next.categoryId,
          next.authorId,
          next.title,
          next.note
        );
      } else if (next.kind === "update") {
        await remoteUpdateItem(next.itemId, next.title, next.note);
      } else if (next.kind === "delete") {
        await remoteDeleteItem(next.itemId);
      } else {
        await remoteCreateCategory(
          next.categoryId,
          next.familyId,
          next.authorId,
          next.name,
          next.sortOrder
        );
      }
      await removeFirstPendingWrite();
    } catch (error) {
      if (isNetworkError(error)) return;
      await removeFirstPendingWrite();
    }
  }
}

export async function getItemWithFallback(
  familyId: string,
  itemId: string
): Promise<{ item: Item; authorName: string } | null> {
  try {
    const item = await remoteGetItem(itemId);
    const names = await listDisplayNames([item.created_by]);
    return { item, authorName: names[item.created_by] ?? "someone" };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const cached = await readCachedFamilyData(familyId);
    const item = cached?.items.find((i) => i.id === itemId);
    if (!item) return null;
    return {
      item,
      authorName: cached?.authorNames[item.created_by] ?? "someone",
    };
  }
}
