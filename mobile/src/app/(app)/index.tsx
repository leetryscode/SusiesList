import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useFamily } from "../../context/family-context";
import type { Category } from "../../lib/categories";
import type { Item } from "../../lib/items";
import {
  flushPendingWrites,
  loadCachedFamilyData,
  refreshFamilyData,
} from "../../lib/sync";

type Section = {
  category: Category;
  title: string;
  data: Item[];
};

function toSections(
  categories: Category[],
  items: Item[]
): Section[] {
  return categories.map((category) => ({
    category,
    title: category.name,
    data: items.filter((item) => item.category_id === category.id),
  }));
}

export default function Home() {
  const { family } = useFamily();
  const [sections, setSections] = useState<Section[]>([]);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    if (!family) return;
    setError(null);

    const cached = await loadCachedFamilyData(family.id);
    if (cached) {
      setSections(toSections(cached.categories, cached.items));
      setAuthorNames(cached.authorNames);
      setIsLoading(false);
    }

    await flushPendingWrites();

    try {
      const fresh = await refreshFamilyData(family.id);
      setSections(toSections(fresh.categories, fresh.items));
      setAuthorNames(fresh.authorNames);
    } catch (loadError) {
      if (!cached) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [family]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={load} />
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/new-item",
                params: { categoryId: section.category.id },
              })
            }
          >
            <Text style={styles.addLink}>+ Add</Text>
          </Pressable>
        </View>
      )}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() =>
            router.push({
              pathname: "/item/[id]",
              params: { id: item.id },
            })
          }
        >
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowAuthor}>
            added by {authorNames[item.created_by] ?? "someone"}
          </Text>
        </Pressable>
      )}
      renderSectionFooter={({ section }) =>
        section.data.length === 0 ? (
          <Text style={styles.empty}>Nothing here yet.</Text>
        ) : null
      }
      ListEmptyComponent={
        error ? <Text style={styles.error}>{error}</Text> : null
      }
      ListFooterComponent={
        <>
          <Pressable
            style={styles.addCategory}
            onPress={() => router.push("/new-category")}
          >
            <Text style={styles.addCategoryText}>+ Add category</Text>
          </Pressable>
          {family?.role === "owner" ? (
            <Text style={styles.inviteCode}>
              Family code: {family.invite_code}
            </Text>
          ) : null}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  addLink: {
    color: "#208AEF",
    fontSize: 15,
    fontWeight: "600",
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  rowTitle: {
    fontSize: 16,
  },
  rowAuthor: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  empty: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    color: "#999",
    fontStyle: "italic",
  },
  addCategory: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    alignItems: "center",
  },
  addCategoryText: {
    color: "#208AEF",
    fontSize: 15,
    fontWeight: "600",
  },
  error: {
    padding: 16,
    color: "#d33",
    textAlign: "center",
  },
  inviteCode: {
    padding: 16,
    color: "#888",
    fontSize: 13,
    textAlign: "center",
  },
});
