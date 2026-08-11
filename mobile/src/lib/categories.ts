import { supabase } from "./supabase";

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
};

export async function listCategories(familyId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, icon, sort_order")
    .eq("family_id", familyId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

/** id is generated client-side (see lib/sync.ts), same reasoning as items:
 * an offline-created category already has its permanent id the moment it's
 * queued. */
export async function createCategory(
  id: string,
  familyId: string,
  authorId: string,
  name: string,
  sortOrder: number
): Promise<void> {
  const { error } = await supabase.from("categories").insert({
    id,
    family_id: familyId,
    created_by: authorId,
    name,
    sort_order: sortOrder,
  });
  if (error) throw error;
}

/** Owner-only; soft-deletes the category and every item in it via the
 * soft_delete_category RPC (see SPEC.md §16) rather than a direct table
 * delete, since categories have no delete RLS policy - deletion always goes
 * through the RPC, same as items go through soft_delete_item. */
export async function deleteCategory(categoryId: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_category", {
    p_category_id: categoryId,
  });
  if (error) throw error;
}
