import { supabase } from "./supabase";

/** Looks up a family's display name by invite code without joining it -
 * backs the "Join <name>'s list?" confirmation. Returns null if the code
 * doesn't match any family. */
export async function previewFamilyName(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("family_name_by_code", {
    p_code: code,
  });
  if (error) return null;
  return (data as string | null) ?? null;
}
