import { supabase } from "./supabase";

export type Item = {
  id: string;
  category_id: string;
  title: string;
  note: string | null;
  photo_paths: string[];
  created_by: string;
  created_at: string;
};

export async function listItems(categoryIds: string[]): Promise<Item[]> {
  if (categoryIds.length === 0) return [];

  const { data, error } = await supabase
    .from("items")
    .select("id, category_id, title, note, photo_paths, created_by, created_at")
    .in("category_id", categoryIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getItem(itemId: string): Promise<Item> {
  const { data, error } = await supabase
    .from("items")
    .select("id, category_id, title, note, photo_paths, created_by, created_at")
    .eq("id", itemId)
    .single();

  if (error) throw error;
  return data;
}

/** id is generated client-side (see lib/sync.ts) so offline-created items
 * keep a stable id from the moment they're created, with nothing to
 * reconcile once the write actually reaches Supabase. photoPaths are already
 * uploaded by the time this runs (see SPEC.md §17 - photo upload is
 * online-only, not part of the offline write queue). */
export async function createItem(
  id: string,
  categoryId: string,
  authorId: string,
  title: string,
  note: string,
  photoPaths: string[]
): Promise<void> {
  const { error } = await supabase.from("items").insert({
    id,
    category_id: categoryId,
    created_by: authorId,
    title,
    note: note.length > 0 ? note : null,
    photo_paths: photoPaths,
  });
  if (error) throw error;
}

/** photoPaths is always written as given (not merged) - callers pass the
 * full desired list, including any existing paths they want kept. Removed
 * paths just drop out of the array; the Storage objects themselves are left
 * orphaned rather than explicitly cleaned up (see SPEC.md §17). */
export async function updateItem(
  itemId: string,
  title: string,
  note: string,
  photoPaths: string[]
): Promise<void> {
  const { error } = await supabase
    .from("items")
    .update({
      title,
      note: note.length > 0 ? note : null,
      photo_paths: photoPaths,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);
  if (error) throw error;
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_item", {
    p_item_id: itemId,
  });
  if (error) throw error;
}
