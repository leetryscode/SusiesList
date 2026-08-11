import { Stack } from "expo-router";

import { useFamily } from "../../context/family-context";
import { colors, fonts } from "../../theme";

export default function AppLayout() {
  const { family } = useFamily();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.textPrimary, fontFamily: fonts.bold },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: family ? `${family.subject_name}'s List` : "Susie's List",
        }}
      />
      <Stack.Screen name="item/[id]" options={{ title: "Details" }} />
      <Stack.Screen name="new-item" options={{ title: "New item" }} />
      <Stack.Screen name="new-category" options={{ title: "New category" }} />
    </Stack>
  );
}
