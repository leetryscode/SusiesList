import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useFamily } from "../context/family-context";
import { colors, fonts } from "../theme";

type Props = {
  /** Prefills the join-code input, e.g. from a stashed deep-link code. */
  initialCode?: string;
  /** Starts with the create-family section already expanded. */
  initialShowCreate?: boolean;
};

export function JoinCreateFamilyForm({
  initialCode = "",
  initialShowCreate = false,
}: Props) {
  const { joinFamily, createFamily } = useFamily();
  const [code, setCode] = useState(initialCode);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(initialShowCreate);
  const [subjectName, setSubjectName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleJoin() {
    setJoinError(null);
    setIsJoining(true);
    const error = await joinFamily(code.trim());
    setIsJoining(false);
    if (error) {
      setJoinError(error);
      return;
    }
    setCode("");
  }

  async function handleCreate() {
    setCreateError(null);
    setIsCreating(true);
    const error = await createFamily(subjectName.trim(), newCode.trim());
    setIsCreating(false);
    if (error) {
      setCreateError(error);
      return;
    }
    setSubjectName("");
    setNewCode("");
  }

  return (
    <View>
      <Text style={styles.label}>Enter your family code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="SUSIE"
        editable={!isJoining}
      />
      <Pressable
        style={[styles.button, isJoining && styles.buttonDisabled]}
        onPress={handleJoin}
        disabled={isJoining || code.trim().length === 0}
      >
        {isJoining ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.buttonText}>Join</Text>
        )}
      </Pressable>
      {joinError && <Text style={styles.error}>{joinError}</Text>}

      <Pressable
        style={styles.linkButton}
        onPress={() => setShowCreate((value) => !value)}
      >
        <Text style={styles.linkText}>
          {showCreate ? "Cancel" : "Set up a new family instead"}
        </Text>
      </Pressable>

      {showCreate && (
        <View style={styles.createSection}>
          <Text style={styles.label}>Who is this list for?</Text>
          <TextInput
            style={styles.input}
            value={subjectName}
            onChangeText={setSubjectName}
            placeholder="Susie"
            autoCorrect={false}
            editable={!isCreating}
          />
          <Text style={styles.label}>Choose a family code</Text>
          <TextInput
            style={styles.input}
            value={newCode}
            onChangeText={setNewCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="SUSIE"
            editable={!isCreating}
          />
          <Pressable
            style={[styles.button, isCreating && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={
              isCreating ||
              subjectName.trim().length === 0 ||
              newCode.trim().length === 0
            }
          >
            {isCreating ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.buttonText}>Create family</Text>
            )}
          </Pressable>
          {createError && <Text style={styles.error}>{createError}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.accent,
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
  linkButton: {
    marginTop: 24,
    alignItems: "center",
  },
  linkText: {
    color: colors.accent,
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  createSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.regular,
    marginTop: 8,
    textAlign: "center",
  },
});
