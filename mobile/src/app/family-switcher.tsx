import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { JoinCreateFamilyForm } from "../components/join-create-family-form";
import { useAuth } from "../context/auth-context";
import { useFamily } from "../context/family-context";
import { shareApp } from "../lib/share";
import { colors, fonts } from "../theme";

type ActiveForm = "create" | "join" | null;

export default function FamilySwitcher() {
  const { signOut } = useAuth();
  const { families, isLoading, setActiveFamily } = useFamily();
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);

  function toggleForm(form: Exclude<ActiveForm, null>) {
    setActiveForm((current) => (current === form ? null : form));
  }

  function confirmSignOut() {
    Alert.alert("Log out?", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
    >
      <Text style={styles.title}>Susie's List</Text>
      <Text style={styles.blurb}>
        A private, shareable list of the books, movies, music, and recipes
        your family wants to pass down — one list per family, just for the
        people you invite.
      </Text>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <View style={styles.familyList}>
          {families.map((family) => (
            <Pressable
              key={family.id}
              style={styles.familyRow}
              onPress={() => setActiveFamily(family.id)}
            >
              <Text style={styles.familyName}>{family.subject_name}</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          style={styles.actionButton}
          onPress={() => toggleForm("create")}
        >
          <Text style={styles.actionButtonText}>
            {activeForm === "create" ? "Cancel" : "Create a new family"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => toggleForm("join")}
        >
          <Text style={styles.actionButtonText}>
            {activeForm === "join" ? "Cancel" : "Join a family with code"}
          </Text>
        </Pressable>
      </View>

      {activeForm && (
        <View style={styles.formSection}>
          <JoinCreateFamilyForm initialShowCreate={activeForm === "create"} />
        </View>
      )}

      <View style={styles.footer}>
        <Pressable style={styles.footerRow} onPress={shareApp} hitSlop={8}>
          <Ionicons name="share-outline" size={16} color={colors.accent} />
          <Text style={styles.footerLinkText}>Share app with Family</Text>
        </Pressable>

        <Pressable
          style={styles.footerRow}
          onPress={confirmSignOut}
          hitSlop={8}
          accessibilityLabel="Log out"
        >
          <Ionicons
            name="log-out-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={styles.footerText}>Log out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: "center",
  },
  blurb: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 32,
    lineHeight: 20,
  },
  loading: {
    marginBottom: 24,
  },
  familyList: {
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 24,
  },
  familyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  familyName: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  formSection: {
    marginTop: 24,
  },
  footer: {
    marginTop: 40,
    gap: 16,
    alignItems: "center",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerLinkText: {
    color: colors.accent,
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
  },
});
