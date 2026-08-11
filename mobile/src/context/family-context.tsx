import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

import {
  clearActiveFamilyId,
  getActiveFamilyId,
  setActiveFamilyId as persistActiveFamilyId,
} from "../lib/active-family";
import { supabase } from "../lib/supabase";
import { useAuth } from "./auth-context";

export type Family = {
  id: string;
  subject_name: string;
  invite_code: string;
  role: "owner" | "member";
};

type FamilyContextValue = {
  families: Family[];
  /** The currently active family, or null if the user has none. */
  family: Family | null;
  isLoading: boolean;
  setActiveFamily: (familyId: string) => void;
  /** Drops the active-family selection (without touching the persisted
   * choice) so the routing gate falls back to the home screen - used by
   * "Switch families" / "Create new family" links inside a family. */
  clearActiveFamily: () => void;
  joinFamily: (code: string) => Promise<string | null>;
  createFamily: (
    subjectName: string,
    inviteCode: string
  ) => Promise<string | null>;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function useFamily() {
  const value = use(FamilyContext);
  if (!value) {
    throw new Error("useFamily must be used within a FamilyProvider");
  }
  return value;
}

async function fetchFamilies(userId: string): Promise<Family[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", userId);

  if (membershipError) throw membershipError;
  if (!memberships || memberships.length === 0) return [];

  const familyIds = memberships.map((m) => m.family_id);
  const { data: familyRows, error: familyError } = await supabase
    .from("families")
    .select("id, subject_name, invite_code")
    .in("id", familyIds);

  if (familyError) throw familyError;

  const roleByFamilyId = new Map(
    memberships.map((m) => [m.family_id, m.role as "owner" | "member"])
  );

  return (familyRows ?? []).map((row) => ({
    id: row.id,
    subject_name: row.subject_name,
    invite_code: row.invite_code,
    role: roleByFamilyId.get(row.id) ?? "member",
  }));
}

export function FamilyProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) {
      setFamilies([]);
      setActiveFamilyId(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const nextFamilies = await fetchFamilies(session.user.id);
    setFamilies(nextFamilies);

    const persistedId = await getActiveFamilyId();
    // A single family is never ambiguous - auto-activate it. With 2+, only
    // trust a persisted id that still matches a real membership; otherwise
    // leave it unresolved (null) rather than guessing, so the caller can
    // show a chooser instead of silently landing in an arbitrary family.
    const resolvedId =
      nextFamilies.length === 1
        ? nextFamilies[0].id
        : nextFamilies.some((f) => f.id === persistedId)
          ? persistedId
          : null;

    if (resolvedId !== persistedId) {
      if (resolvedId) {
        await persistActiveFamilyId(resolvedId);
      } else {
        await clearActiveFamilyId();
      }
    }
    setActiveFamilyId(resolvedId);
    setIsLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function setActiveFamily(familyId: string) {
    if (!families.some((f) => f.id === familyId)) return;
    setActiveFamilyId(familyId);
    persistActiveFamilyId(familyId);
  }

  function clearActiveFamily() {
    setActiveFamilyId(null);
  }

  async function activateFamily(familyId: string) {
    setActiveFamilyId(familyId);
    await persistActiveFamilyId(familyId);
  }

  async function joinFamily(code: string) {
    const { data, error } = await supabase.rpc("join_family", {
      p_code: code,
    });
    if (error) return error.message;
    await refresh();
    if (data) await activateFamily(data);
    return null;
  }

  async function createFamily(subjectName: string, inviteCode: string) {
    const { data, error } = await supabase.rpc("create_family", {
      p_subject_name: subjectName,
      p_invite_code: inviteCode,
    });
    if (error) return error.message;
    await refresh();
    if (data) await activateFamily(data);
    return null;
  }

  const family = families.find((f) => f.id === activeFamilyId) ?? null;

  return (
    <FamilyContext
      value={{
        families,
        family,
        isLoading,
        setActiveFamily,
        clearActiveFamily,
        joinFamily,
        createFamily,
      }}
    >
      {children}
    </FamilyContext>
  );
}
