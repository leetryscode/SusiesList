import { Stack } from "expo-router";
import { Pressable, Text } from "react-native";

import { useAuth } from "../../context/auth-context";
import { useFamily } from "../../context/family-context";

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Pressable onPress={signOut} hitSlop={8}>
      <Text style={{ color: "#208AEF", fontSize: 15 }}>Sign out</Text>
    </Pressable>
  );
}

export default function AppLayout() {
  const { family } = useFamily();

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="index"
        options={{
          title: family ? `${family.subject_name}'s List` : "Susie's List",
          headerRight: SignOutButton,
        }}
      />
      <Stack.Screen name="item/[id]" options={{ title: "Details" }} />
      <Stack.Screen name="new-item" options={{ title: "New item" }} />
    </Stack>
  );
}
