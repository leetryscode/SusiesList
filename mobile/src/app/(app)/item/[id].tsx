import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "../../../context/auth-context";
import { useFamily } from "../../../context/family-context";
import type { Item } from "../../../lib/items";
import {
  getRecipePhotoUrls,
  pickRecipePhotos,
  uploadRecipePhotos,
  type PickedPhoto,
} from "../../../lib/photos";
import {
  deleteItemOffline,
  getItemWithFallback,
  updateItemOffline,
} from "../../../lib/sync";
import { colors, fonts } from "../../../theme";

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { family } = useFamily();
  const router = useRouter();

  const [item, setItem] = useState<Item | null>(null);
  const [authorName, setAuthorName] = useState("someone");
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [remainingPhotoPaths, setRemainingPhotoPaths] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<PickedPhoto[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id || !family) return;
    setError(null);
    try {
      const result = await getItemWithFallback(family.id, id);
      if (!result) {
        setError("Item not found.");
        return;
      }
      setItem(result.item);
      setAuthorName(result.authorName);
      setTitle(result.item.title);
      setNote(result.item.note ?? "");
      setPhotoUrls(await getRecipePhotoUrls(result.item.photo_paths));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load."
      );
    } finally {
      setIsLoading(false);
    }
  }, [id, family]);

  useEffect(() => {
    load();
  }, [load]);

  const isAuthor = !!item && item.created_by === session?.user.id;
  const canDelete = isAuthor || family?.role === "owner";

  function startEditing() {
    if (!item) return;
    setRemainingPhotoPaths(item.photo_paths);
    setNewPhotos([]);
    setIsEditing(true);
  }

  function cancelEditing() {
    if (!item) return;
    setIsEditing(false);
    setTitle(item.title);
    setNote(item.note ?? "");
    setRemainingPhotoPaths(item.photo_paths);
    setNewPhotos([]);
  }

  async function handlePickPhotos() {
    const picked = await pickRecipePhotos();
    if (picked.length > 0) setNewPhotos((prev) => [...prev, ...picked]);
  }

  async function handleSave() {
    if (!item || !family) return;
    setIsSaving(true);

    let uploadedPaths: string[] = [];
    if (newPhotos.length > 0) {
      try {
        uploadedPaths = await uploadRecipePhotos(family.id, newPhotos);
      } catch (uploadError) {
        setIsSaving(false);
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Couldn't upload photos. Check your connection and try again."
        );
        return;
      }
    }

    const saveError = await updateItemOffline(
      family.id,
      item.id,
      title.trim(),
      note.trim(),
      [...remainingPhotoPaths, ...uploadedPaths]
    );
    setIsSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    setIsEditing(false);
    setNewPhotos([]);
    await load();
  }

  function confirmDelete() {
    if (!item || !family) return;
    Alert.alert("Delete this item?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setIsDeleting(true);
          const deleteError = await deleteItemOffline(family.id, item.id);
          setIsDeleting(false);
          if (deleteError) {
            setError(deleteError);
            return;
          }
          router.back();
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Item not found."}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {isEditing ? (
        <>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            editable={!isSaving}
          />
          <Text style={styles.label}>Note</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            multiline
            editable={!isSaving}
          />
          {(remainingPhotoPaths.length > 0 || newPhotos.length > 0) && (
            <View style={styles.photoGrid}>
              {remainingPhotoPaths.map((path) =>
                photoUrls[path] ? (
                  <View key={path} style={styles.photoThumbWrap}>
                    <Image
                      source={{ uri: photoUrls[path] }}
                      style={styles.photoThumb}
                    />
                    <Pressable
                      style={styles.removeThumbButton}
                      onPress={() =>
                        setRemainingPhotoPaths((prev) =>
                          prev.filter((p) => p !== path)
                        )
                      }
                      disabled={isSaving}
                      hitSlop={8}
                    >
                      <Text style={styles.removeThumbText}>×</Text>
                    </Pressable>
                  </View>
                ) : null
              )}
              {newPhotos.map((photo, index) => (
                <View key={`new-${index}`} style={styles.photoThumbWrap}>
                  <Image
                    source={{
                      uri: `data:${photo.mimeType};base64,${photo.base64}`,
                    }}
                    style={styles.photoThumb}
                  />
                  <Pressable
                    style={styles.removeThumbButton}
                    onPress={() =>
                      setNewPhotos((prev) =>
                        prev.filter((_, i) => i !== index)
                      )
                    }
                    disabled={isSaving}
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
            disabled={isSaving}
          >
            <Text style={styles.photoButtonText}>+ Add Photo</Text>
          </Pressable>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={cancelEditing}
              disabled={isSaving}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, isSaving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={isSaving || title.trim().length === 0}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.buttonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.author}>added by {authorName}</Text>
          {item.photo_paths.length > 0 && (
            <View style={styles.photoGrid}>
              {item.photo_paths.map((path) =>
                photoUrls[path] ? (
                  <Image
                    key={path}
                    source={{ uri: photoUrls[path] }}
                    style={styles.photo}
                  />
                ) : null
              )}
            </View>
          )}
          <Text style={styles.note}>{item.note || "No note."}</Text>

          {(isAuthor || canDelete) && (
            <View style={styles.buttonRow}>
              {isAuthor && (
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={startEditing}
                >
                  <Text style={styles.secondaryButtonText}>Edit</Text>
                </Pressable>
              )}
              {canDelete && (
                <Pressable
                  style={[styles.button, styles.deleteButton]}
                  onPress={confirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <Text style={styles.buttonText}>Delete</Text>
                  )}
                </Pressable>
              )}
            </View>
          )}
        </>
      )}

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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  author: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  photo: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  note: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    lineHeight: 22,
    marginTop: 16,
    marginBottom: 32,
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
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
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
  secondaryButton: {
    backgroundColor: colors.card,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  deleteButton: {
    backgroundColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.regular,
    marginTop: 16,
    textAlign: "center",
  },
});
