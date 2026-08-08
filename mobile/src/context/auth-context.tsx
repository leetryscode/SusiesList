import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  use,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

import { supabase } from "../lib/supabase";

export type Profile = {
  id: string;
  display_name: string;
  created_at: string;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  sendOtp: (email: string) => Promise<string | null>;
  verifyOtp: (email: string, token: string) => Promise<string | null>;
  completeProfile: (displayName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProfileForSession(nextSession: Session | null) {
      if (!nextSession) {
        if (isMounted) setProfile(null);
        return;
      }
      const nextProfile = await fetchProfile(nextSession.user.id);
      if (isMounted) setProfile(nextProfile);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      await loadProfileForSession(data.session);
      if (isMounted) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        await loadProfileForSession(nextSession);
        if (isMounted) setSession(nextSession);
      }
    );

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function sendOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return error?.message ?? null;
  }

  async function verifyOtp(email: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    return error?.message ?? null;
  }

  async function completeProfile(displayName: string) {
    if (!session) return "Not signed in.";
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: session.user.id, display_name: displayName })
      .select("id, display_name, created_at")
      .single();

    if (error) return error.message;
    setProfile(data);
    return null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext
      value={{
        session,
        profile,
        isLoading,
        sendOtp,
        verifyOtp,
        completeProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext>
  );
}
