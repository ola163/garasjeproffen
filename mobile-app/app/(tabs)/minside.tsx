import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { supabase, SavedConfig } from "@/lib/supabase";
import { Colors } from "@/constants/Colors";

export default function MinSideScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) loadConfigs();
  }, [user]);

  async function loadConfigs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_configs")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (!error && data) setConfigs(data as SavedConfig[]);
  }

  async function deleteConfig(id: string) {
    Alert.alert("Slett konfigurasjon", "Er du sikker?", [
      { text: "Avbryt", style: "cancel" },
      {
        text: "Slett", style: "destructive",
        onPress: async () => {
          await supabase.from("saved_configs").delete().eq("id", id);
          setConfigs((prev) => prev.filter((c) => c.id !== id));
        },
      },
    ]);
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-circle-outline" size={72} color={Colors.gray400} />
        <Text style={styles.notLoggedTitle}>Ikke innlogget</Text>
        <Text style={styles.notLoggedSub}>Logg inn for å lagre og hente dine garasjemodeller</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/login")}>
          <Text style={styles.loginBtnText}>Logg inn / Opprett konto</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profil */}
      <View style={styles.profileCard}>
        <Ionicons name="person-circle-outline" size={48} color={Colors.orange} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.emailSub}>Innlogget bruker</Text>
        </View>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.logoutText}>Logg ut</Text>
        </TouchableOpacity>
      </View>

      {/* Lagrede konfigurasjoner */}
      <Text style={styles.sectionTitle}>Mine konfigurasjoner</Text>

      {loading ? (
        <ActivityIndicator color={Colors.orange} style={{ marginTop: 32 }} />
      ) : configs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="construct-outline" size={36} color={Colors.gray400} />
          <Text style={styles.emptyText}>Ingen lagrede konfigurasjoner ennå</Text>
          <Text style={styles.emptySub}>Bygg en garasje i konfiguratoren og trykk «Lagre»</Text>
        </View>
      ) : (
        configs.map((c) => (
          <View key={c.id} style={styles.configCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.configName}>{c.name}</Text>
              <Text style={styles.configDetails}>
                {(c.config.width / 1000).toFixed(1)} m × {(c.config.length / 1000).toFixed(1)} m
                {"  ·  "}{c.config.roofType === "saltak" ? "Saltak" : "Flattak"}
                {"  ·  "}{c.config.packageType === "prefab" ? "Prefab" : "Materialpakke"}
              </Text>
              <Text style={styles.configDate}>
                {new Date(c.created_at).toLocaleDateString("nb-NO")}
              </Text>
            </View>
            <TouchableOpacity onPress={() => deleteConfig(c.id)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={20} color={Colors.gray400} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.gray50 },
  content:        { padding: 16, paddingBottom: 40, gap: 12 },
  center:         { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  notLoggedTitle: { fontSize: 20, fontWeight: "700", color: Colors.gray900, marginTop: 16 },
  notLoggedSub:   { fontSize: 14, color: Colors.gray500, textAlign: "center", marginTop: 8, marginBottom: 24, lineHeight: 20 },
  loginBtn:       { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32 },
  loginBtnText:   { color: Colors.white, fontWeight: "700", fontSize: 16 },
  profileCard:    { backgroundColor: Colors.white, borderRadius: 12, padding: 16,
                    borderWidth: 1, borderColor: Colors.gray200, flexDirection: "row", alignItems: "center" },
  email:          { fontSize: 15, fontWeight: "600", color: Colors.gray900 },
  emailSub:       { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  logoutText:     { fontSize: 14, color: Colors.orange, fontWeight: "600" },
  sectionTitle:   { fontSize: 15, fontWeight: "700", color: Colors.gray900, marginTop: 4 },
  emptyCard:      { backgroundColor: Colors.white, borderRadius: 12, padding: 32,
                    borderWidth: 1, borderColor: Colors.gray200, alignItems: "center" },
  emptyText:      { fontSize: 15, fontWeight: "600", color: Colors.gray700, marginTop: 12 },
  emptySub:       { fontSize: 13, color: Colors.gray400, textAlign: "center", marginTop: 6, lineHeight: 18 },
  configCard:     { backgroundColor: Colors.white, borderRadius: 12, padding: 16,
                    borderWidth: 1, borderColor: Colors.gray200, flexDirection: "row", alignItems: "center" },
  configName:     { fontSize: 15, fontWeight: "700", color: Colors.gray900, marginBottom: 4 },
  configDetails:  { fontSize: 13, color: Colors.gray500 },
  configDate:     { fontSize: 12, color: Colors.gray400, marginTop: 4 },
  deleteBtn:      { padding: 8 },
});
