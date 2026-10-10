import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useFamily } from "../context/family-context";
import { usePendingInvite } from "../context/pending-invite-context";
import { previewFamilyName } from "../lib/family-preview";
import { colors, fonts } from "../theme";

export default function JoinConfirm() {
  const { pendingCode, clearPendingCode } = usePendingInvite();
  const { families, joinFamily, setActiveFamily } = useFamily();

  const [familyName, setFamilyName] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(true);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingCode) return;
    // Tapping an invite to a family you're already in (e.g. your own shared
    // link) just switches to it rather than asking "Join X's list?".
    const existing = families.find(
      (f) => f.invite_code.toUpperCase() === pendingCode.trim().toUpperCase()
    );
    if (existing) {
      setActiveFamily(existing.id);
      clearPendingCode();
      return;
    }
    let isMounted = true;
    setIsLookingUp(true);
    setLookupFailed(false);
    previewFamilyName(pendingCode).then((name) => {
      if (!isMounted) return;
      if (name) {
        setFamilyName(name);
      } else {
        setLookupFailed(true);
      }
      setIsLookingUp(false);
    });
    return () => {
      isMounted = false;
    };
    // Only re-run for a new code; families is already loaded by the time
    // this screen can be reached (RootNavigator waits on it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCode]);

  if (!pendingCode) return null;

  async function handleConfirm() {
    setJoinError(null);
    setIsJoining(true);
    const error = await joinFamily(pendingCode!);
    setIsJoining(false);
    if (error) {
      setJoinError(error);
      return;
    }
    clearPendingCode();
  }

  function handleDismiss() {
    clearPendingCode();
  }

  return (
    <View style={styles.container}>
      {isLookingUp ? (
        <ActivityIndicator color={colors.accent} />
      ) : lookupFailed ? (
        <>
          <Text style={styles.title}>Invite code not found</Text>
          <Text style={styles.body}>
            "{pendingCode}" doesn't match a family list. It may be mistyped or
            no longer valid.
          </Text>
          <Pressable style={styles.primaryButton} onPress={handleDismiss}>
            <Text style={styles.primaryButtonText}>OK</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.title}>Join {familyName}'s list?</Text>
          <Text style={styles.body}>
            You'll be added as a member. Your other families stay put -
            switch back to them anytime.
          </Text>
          {joinError && <Text style={styles.error}>{joinError}</Text>}
          <Pressable
            style={[styles.primaryButton, isJoining && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={isJoining}
          >
            {isJoining ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.primaryButtonText}>Join</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={handleDismiss}
            disabled={isJoining}
          >
            <Text style={styles.secondaryButtonText}>Not now</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: "center",
    minWidth: 160,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  secondaryButton: {
    marginTop: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.regular,
    marginBottom: 16,
    textAlign: "center",
  },
});
