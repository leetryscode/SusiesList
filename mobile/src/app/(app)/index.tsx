import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
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
import { colors, fonts } from "../../theme";

type Section = {
  category: Category;
  title: string;
  data: Item[];
};

/** The four seeded defaults get a hand-picked label ("Music" -> "song" isn't
 * a grammatical singular, it's a content choice). Custom categories fall
 * back to a plural-to-singular heuristic, and to "item" when that heuristic
 * can't confidently strip a plural ending - better a generic label than a
 * grammatically wrong one. */
const DEFAULT_ITEM_LABELS: Record<string, string> = {
  Books: "book",
  Movies: "movie",
  Music: "song",
  Recipes: "recipe",
};

function singularItemLabel(categoryName: string): string {
  const known = DEFAULT_ITEM_LABELS[categoryName];
  if (known) return known;

  const lower = categoryName.toLowerCase();
  if (lower.endsWith("ies") && lower.length > 3) {
    return `${lower.slice(0, -3)}y`;
  }
  if (/(s|x|z|ch|sh)es$/.test(lower)) {
    return lower.slice(0, -2);
  }
  if (lower.endsWith("s") && !lower.endsWith("ss")) {
    return lower.slice(0, -1);
  }
  return "item";
}

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      {sections.length === 0 && error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        sections.map((section) => (
          <View key={section.category.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/new-item",
                    params: { categoryId: section.category.id },
                  })
                }
              >
                <Text style={styles.addLink}>
                  + Add {singularItemLabel(section.title)}
                </Text>
              </Pressable>
            </View>
            <View style={styles.divider} />
            {section.data.length === 0 ? (
              <Text style={styles.empty}>Nothing here yet.</Text>
            ) : (
              section.data.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.row,
                    index === section.data.length - 1 && styles.rowLast,
                  ]}
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
              ))
            )}
          </View>
        ))
      )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  addLink: {
    color: colors.accent,
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowTitle: {
    flex: 1,
    marginRight: 8,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  rowAuthor: {
    flexShrink: 0,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontStyle: "italic",
  },
  addCategory: {
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: "center",
  },
  addCategoryText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  error: {
    padding: 16,
    color: colors.danger,
    fontFamily: fonts.regular,
    textAlign: "center",
  },
  inviteCode: {
    padding: 16,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: "center",
  },
});
