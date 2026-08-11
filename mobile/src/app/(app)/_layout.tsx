import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { Pressable, Text } from "react-native";

import { shareApp } from "../../lib/share";
import { useFamily } from "../../context/family-context";
import { colors, fonts } from "../../theme";

function ShareButton() {
  return (
    <Pressable
      onPress={shareApp}
      hitSlop={8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: colors.card,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Ionicons name="share-outline" size={16} color={colors.accent} />
      <Text
        style={{
          color: colors.accent,
          fontSize: 15,
          fontFamily: fonts.semiBold,
        }}
      >
        Share
      </Text>
    </Pressable>
  );
}

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
          headerRight: ShareButton,
        }}
      />
      <Stack.Screen name="item/[id]" options={{ title: "Details" }} />
      <Stack.Screen name="new-item" options={{ title: "New item" }} />
      <Stack.Screen name="new-category" options={{ title: "New category" }} />
    </Stack>
  );
}
