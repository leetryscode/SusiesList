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
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}
