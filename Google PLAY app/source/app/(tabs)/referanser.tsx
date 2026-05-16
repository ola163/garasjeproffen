import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, Image, StyleSheet,
  TouchableOpacity, ActivityIndicator, Dimensions, Modal, Pressable,
} from "react-native";
import { Colors } from "@/constants/Colors";

const API_BASE = "https://garasjeproffen.no";
const NUM_COLS = 2;
const GAP      = 8;
const PADDING  = 16;
const { width: SCREEN_W } = Dimensions.get("window");
const IMG_SIZE = (SCREEN_W - PADDING * 2 - GAP * (NUM_COLS - 1)) / NUM_COLS;

interface FbPost { id: string; message?: string; full_picture?: string; created_time: string; }

const CATEGORY_OPTIONS = ["Alle", "Garasje/Carport", "Hagestue/Bod", "Verksted", "Hytte/Anneks"];

export default function ReferanserScreen() {
  const [posts,     setPosts]     = useState<FbPost[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [selected,  setSelected]  = useState<FbPost | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/api/facebook-feed`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPosts(data.filter((p: FbPost) => p.full_picture));
      }
    } catch {
      setError("Kunne ikke laste referanser.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.orange} />
        <Text style={styles.loadingText}>Laster referanser…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Prøv igjen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Ingen referanser funnet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.85}>
            <Image
              source={{ uri: item.full_picture }}
              style={styles.thumb}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
      />

      {/* Lightbox */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          <View style={styles.lightbox}>
            {selected?.full_picture && (
              <Image
                source={{ uri: selected.full_picture }}
                style={styles.lightboxImg}
                resizeMode="contain"
              />
            )}
            {selected?.message ? (
              <Text style={styles.lightboxCaption} numberOfLines={4}>
                {selected.message}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  list:      { padding: PADDING, gap: GAP },
  row:       { gap: GAP, marginBottom: GAP },
  thumb:     { width: IMG_SIZE, height: IMG_SIZE, borderRadius: 8, backgroundColor: Colors.gray100 },
  center:    { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  loadingText: { fontSize: 14, color: Colors.gray500, marginTop: 8 },
  errorText:   { fontSize: 15, color: Colors.gray700, textAlign: "center" },
  retryBtn:    { backgroundColor: Colors.orange, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText:   { color: Colors.white, fontWeight: "700" },
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center" },
  lightbox:    { width: SCREEN_W - 32, maxHeight: SCREEN_W - 32, borderRadius: 12, overflow: "hidden",
                 backgroundColor: Colors.gray900 },
  lightboxImg: { width: "100%", aspectRatio: 1 },
  lightboxCaption: { color: Colors.gray400, fontSize: 13, padding: 12, lineHeight: 19 },
});
