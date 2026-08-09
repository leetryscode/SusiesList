import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "./auth-context";

export type Family = {
  id: string;
  subject_name: string;
  invite_code: string;
  role: "owner" | "member";
};

type FamilyContextValue = {
  family: Family | null;
  isLoading: boolean;
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

async function fetchFamily(userId: string): Promise<Family | null> {
  const { data: membership, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return null;

  const { data: familyRow, error: familyError } = await supabase
    .from("families")
    .select("id, subject_name, invite_code")
    .eq("id", membership.family_id)
    .single();

  if (familyError) throw familyError;

  return {
    id: familyRow.id,
    subject_name: familyRow.subject_name,
    invite_code: familyRow.invite_code,
    role: membership.role as "owner" | "member",
  };
}

export function FamilyProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) {
      setFamily(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const nextFamily = await fetchFamily(session.user.id);
    setFamily(nextFamily);
    setIsLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function joinFamily(code: string) {
    const { error } = await supabase.rpc("join_family", { p_code: code });
    if (error) return error.message;
    await refresh();
    return null;
  }

  async function createFamily(subjectName: string, inviteCode: string) {
    const { error } = await supabase.rpc("create_family", {
      p_subject_name: subjectName,
      p_invite_code: inviteCode,
    });
    if (error) return error.message;
    await refresh();
    return null;
  }

  return (
    <FamilyContext value={{ family, isLoading, joinFamily, createFamily }}>
      {children}
    </FamilyContext>
  );
}
