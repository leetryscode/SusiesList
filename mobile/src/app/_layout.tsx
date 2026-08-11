import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from "@expo-google-fonts/nunito";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "../context/auth-context";
import { FamilyProvider, useFamily } from "../context/family-context";
import {
  PendingInviteProvider,
  usePendingInvite,
} from "../context/pending-invite-context";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <FamilyProvider>
        <PendingInviteProvider>
          <RootNavigator />
        </PendingInviteProvider>
      </FamilyProvider>
    </AuthProvider>
  );
}

type Screen =
  | "sign-in"
  | "complete-profile"
  | "join-confirm"
  | "app"
  | "join-family"
  | "family-switcher";

function resolveScreen({
  hasSession,
  hasProfile,
  pendingCode,
  familyCount,
  hasActiveFamily,
}: {
  hasSession: boolean;
  hasProfile: boolean;
  pendingCode: string | null;
  familyCount: number;
  hasActiveFamily: boolean;
}): Screen {
  if (!hasSession) return "sign-in";
  if (!hasProfile) return "complete-profile";
  // Brand-new (0-family) users keep the existing join-family onboarding
  // untouched, code prefilled there instead - this interstitial is only for
  // people who already belong to at least one family, where a joined code
  // would otherwise be silently dropped.
  if (pendingCode && familyCount > 0) return "join-confirm";
  if (hasActiveFamily) return "app";
  if (familyCount === 0) return "join-family";
  return "family-switcher";
}

function RootNavigator() {
  const { session, profile, isLoading: isAuthLoading } = useAuth();
  const { families, family, isLoading: isFamilyLoading } = useFamily();
  const { pendingCode, isLoading: isPendingInviteLoading } =
    usePendingInvite();
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  const isLoading =
    !fontsLoaded ||
    isAuthLoading ||
    isPendingInviteLoading ||
    (!!session && isFamilyLoading);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  const screen = resolveScreen({
    hasSession: !!session,
    hasProfile: !!profile,
    pendingCode,
    familyCount: families.length,
    hasActiveFamily: !!family,
  });

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={screen === "app"}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={screen === "join-confirm"}>
        <Stack.Screen name="join-confirm" />
      </Stack.Protected>

      <Stack.Protected guard={screen === "family-switcher"}>
        <Stack.Screen name="family-switcher" />
      </Stack.Protected>

      <Stack.Protected guard={screen === "join-family"}>
        <Stack.Screen name="join-family" />
      </Stack.Protected>

      <Stack.Protected guard={screen === "complete-profile"}>
        <Stack.Screen name="complete-profile" />
      </Stack.Protected>

      <Stack.Protected guard={screen === "sign-in"}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Screen name="join/[code]" />
    </Stack>
  );
}
