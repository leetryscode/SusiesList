import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from "react-native";

import { JoinCreateFamilyForm } from "../components/join-create-family-form";
import { usePendingInvite } from "../context/pending-invite-context";
import { colors, fonts } from "../theme";

export default function JoinFamily() {
  const { pendingCode, clearPendingCode } = usePendingInvite();
  const [initialCode] = useState(() => pendingCode ?? "");

  useEffect(() => {
    if (pendingCode) clearPendingCode();
    // Only consume whatever pending code existed at mount, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Join a family</Text>
      <JoinCreateFamilyForm initialCode={initialCode} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 24,
    textAlign: "center",
  },
});
