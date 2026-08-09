import { supabase } from "./supabase";

export type Item = {
  id: string;
  category_id: string;
  title: string;
  note: string | null;
  created_by: string;
  created_at: string;
};

export async function listItems(categoryIds: string[]): Promise<Item[]> {
  if (categoryIds.length === 0) return [];

  const { data, error } = await supabase
    .from("items")
    .select("id, category_id, title, note, created_by, created_at")
    .in("category_id", categoryIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getItem(itemId: string): Promise<Item> {
  const { data, error } = await supabase
    .from("items")
    .select("id, category_id, title, note, created_by, created_at")
    .eq("id", itemId)
    .single();

  if (error) throw error;
  return data;
}

/** id is generated client-side (see lib/sync.ts) so offline-created items
 * keep a stable id from the moment they're created, with nothing to
 * reconcile once the write actually reaches Supabase. */
export async function createItem(
  id: string,
  categoryId: string,
  authorId: string,
  title: string,
  note: string
): Promise<void> {
  const { error } = await supabase.from("items").insert({
    id,
    category_id: categoryId,
    created_by: authorId,
    title,
    note: note.length > 0 ? note : null,
  });
  if (error) throw error;
}

export async function updateItem(
  itemId: string,
  title: string,
  note: string
): Promise<void> {
  const { error } = await supabase
    .from("items")
    .update({
      title,
      note: note.length > 0 ? note : null,
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
