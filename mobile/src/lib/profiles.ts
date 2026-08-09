import { supabase } from "./supabase";

export async function listDisplayNames(
  userIds: string[]
): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", uniqueIds);

  if (error) throw error;

  const names: Record<string, string> = {};
  for (const row of data) {
    names[row.id] = row.display_name;
  }
  return names;
}
