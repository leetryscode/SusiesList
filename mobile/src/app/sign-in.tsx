import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "../context/auth-context";

export default function SignIn() {
  const { sendOtp, verifyOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode() {
    setError(null);
    setIsSubmitting(true);
    const sendError = await sendOtp(email.trim());
    setIsSubmitting(false);
    if (sendError) {
      setError(sendError);
      return;
    }
    setCodeSent(true);
  }

  async function handleVerifyCode() {
    setError(null);
    setIsSubmitting(true);
    const verifyError = await verifyOtp(email.trim(), code.trim());
    setIsSubmitting(false);
    if (verifyError) {
      setError(verifyError);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Susie's List</Text>

      {!codeSent ? (
        <>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            editable={!isSubmitting}
          />
          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={isSubmitting || email.trim().length === 0}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send code</Text>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.label}>
            Enter the 6-digit code sent to {email.trim()}
          </Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholder="123456"
            maxLength={6}
            editable={!isSubmitting}
          />
          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleVerifyCode}
            disabled={isSubmitting || code.trim().length === 0}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.linkButton}
            onPress={() => {
              setCodeSent(false);
              setCode("");
              setError(null);
            }}
            disabled={isSubmitting}
          >
            <Text style={styles.linkText}>Use a different email</Text>
          </Pressable>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 32,
    textAlign: "center",
  },
  label: {
    fontSize: 15,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#208AEF",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 16,
    alignItems: "center",
  },
  linkText: {
    color: "#208AEF",
    fontSize: 14,
  },
  error: {
    color: "#d33",
    marginTop: 16,
    textAlign: "center",
  },
});
