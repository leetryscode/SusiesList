import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { deleteItem, getItem, updateItem, type Item } from "../../../lib/items";
import { listDisplayNames } from "../../../lib/profiles";

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { family } = useFamily();
  const router = useRouter();

  const [item, setItem] = useState<Item | null>(null);
  const [authorName, setAuthorName] = useState("someone");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const loadedItem = await getItem(id);
      const names = await listDisplayNames([loadedItem.created_by]);
      setItem(loadedItem);
      setAuthorName(names[loadedItem.created_by] ?? "someone");
      setTitle(loadedItem.title);
      setNote(loadedItem.note ?? "");
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load."
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isAuthor = !!item && item.created_by === session?.user.id;
  const canDelete = isAuthor || family?.role === "owner";

  async function handleSave() {
    if (!item) return;
    setIsSaving(true);
    const saveError = await updateItem(item.id, title.trim(), note.trim());
    setIsSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    setIsEditing(false);
    await load();
  }

  function confirmDelete() {
    if (!item) return;
    Alert.alert("Delete this item?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setIsDeleting(true);
          const deleteError = await deleteItem(item.id);
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
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                setIsEditing(false);
                setTitle(item.title);
                setNote(item.note ?? "");
              }}
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
                <ActivityIndicator color="#fff" />
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
          <Text style={styles.note}>{item.note || "No note."}</Text>

          {(isAuthor || canDelete) && (
            <View style={styles.buttonRow}>
              {isAuthor && (
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => setIsEditing(true)}
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
                    <ActivityIndicator color="#fff" />
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
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  author: {
    fontSize: 14,
    color: "#888",
    marginBottom: 24,
  },
  note: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 32,
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
  noteInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
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
  secondaryButton: {
    backgroundColor: "#eee",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "#d33",
  },
  error: {
    color: "#d33",
    marginTop: 16,
    textAlign: "center",
  },
});
