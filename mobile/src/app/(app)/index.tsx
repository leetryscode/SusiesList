import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../context/auth-context";
import { useFamily } from "../../context/family-context";

export default function Home() {
  const { profile, signOut } = useAuth();
  const { family } = useFamily();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {profile?.display_name}</Text>
      <Text style={styles.subtitle}>
        {family?.subject_name}'s List is coming soon.
      </Text>
      {family?.role === "owner" && (
        <Text style={styles.inviteCode}>
          Family code: {family.invite_code}
        </Text>
      )}
      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 8,
  },
  inviteCode: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#eee",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
