import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "../../context/auth-context";
import { useFamily } from "../../context/family-context";
import {
  pickRecipePhotos,
  uploadRecipePhotos,
  type PickedPhoto,
} from "../../lib/photos";
import { createItemOffline } from "../../lib/sync";
import { colors, fonts } from "../../theme";

export default function NewItem() {
  const { categoryId, categoryName } = useLocalSearchParams<{
    categoryId: string;
    categoryName: string;
  }>();
  const { session } = useAuth();
  const { family } = useFamily();
  const router = useRouter();

  const isRecipe = categoryName === "Recipes";

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePickPhotos() {
    const picked = await pickRecipePhotos();
    if (picked.length > 0) setPhotos((prev) => [...prev, ...picked]);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAdd() {
    if (!session || !family || !categoryId) return;
    setError(null);
    setIsSubmitting(true);

    let photoPaths: string[] = [];
    if (photos.length > 0) {
      try {
        photoPaths = await uploadRecipePhotos(family.id, photos);
      } catch (uploadError) {
        setIsSubmitting(false);
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Couldn't upload photos. Check your connection and try again."
        );
        return;
      }
    }

    const submitError = await createItemOffline(
      family.id,
      categoryId,
      session.user.id,
      title.trim(),
      note.trim(),
      photoPaths
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
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        autoFocus
        editable={!isSubmitting}
      />
      <Text style={styles.label}>Note (optional)</Text>
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={note}
        onChangeText={setNote}
        multiline
        editable={!isSubmitting}
      />
      {isRecipe && (
        <>
          <Text style={styles.label}>Photos (optional)</Text>
          {photos.length > 0 && (
            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoThumbWrap}>
                  <Image
                    source={{
                      uri: `data:${photo.mimeType};base64,${photo.base64}`,
                    }}
                    style={styles.photoThumb}
                  />
                  <Pressable
                    style={styles.removeThumbButton}
                    onPress={() => removePhoto(index)}
                    disabled={isSubmitting}
                    hitSlop={8}
                  >
                    <Text style={styles.removeThumbText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Pressable
            style={styles.photoButton}
            onPress={handlePickPhotos}
            disabled={isSubmitting}
          >
            <Text style={styles.photoButtonText}>+ Add Photo</Text>
          </Pressable>
        </>
      )}
      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleAdd}
        disabled={isSubmitting || title.trim().length === 0}
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
  noteInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  photoButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.card,
    marginBottom: 16,
  },
  photoButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  photoThumbWrap: {
    position: "relative",
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  removeThumbButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  removeThumbText: {
    color: colors.onAccent,
    fontSize: 13,
    lineHeight: 14,
    fontFamily: fonts.semiBold,
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
  error: {
    color: colors.danger,
    fontFamily: fonts.regular,
    marginTop: 16,
    textAlign: "center",
  },
});
