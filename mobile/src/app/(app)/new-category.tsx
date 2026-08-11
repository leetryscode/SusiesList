import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import { useAuth } from "../../context/auth-context";
import { useFamily } from "../../context/family-context";
import { createCategoryOffline } from "../../lib/sync";
import { colors, fonts } from "../../theme";

export default function NewCategory() {
  const { session } = useAuth();
  const { family } = useFamily();
  const router = useRouter();

  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!session || !family) return;
    setError(null);
    setIsSubmitting(true);
    const submitError = await createCategoryOffline(
      family.id,
      session.user.id,
      name.trim()
    );
    setIsSubmitting(false);
    if (submitError) {
      setError(submitError);
      return;
    }
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        autoFocus
        editable={!isSubmitting}
      />
      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleAdd}
        disabled={isSubmitting || name.trim().length === 0}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.buttonText}>Add</Text>
        )}
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: colors.background,
  },
  label: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    backgroundColor: colors.card,
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.accentSecondary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.regular,
    marginTop: 16,
    textAlign: "center",
  },
});
