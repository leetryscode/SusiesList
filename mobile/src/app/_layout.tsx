import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "../context/auth-context";
import { FamilyProvider, useFamily } from "../context/family-context";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <FamilyProvider>
        <RootNavigator />
      </FamilyProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const { session, profile, isLoading: isAuthLoading } = useAuth();
  const { family, isLoading: isFamilyLoading } = useFamily();

  const isLoading = isAuthLoading || (!!session && isFamilyLoading);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="join/[code]" />

      <Stack.Protected guard={!!session && !!profile && !!family}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!profile && !family}>
        <Stack.Screen name="join-family" />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !profile}>
        <Stack.Screen name="complete-profile" />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
