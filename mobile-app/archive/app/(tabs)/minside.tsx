import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/Colors";

const API_BASE = "https://garasjeproffen.no";
const STORAGE_KEY = "gp_session";

const FEATURES = [
  { icon: "save-outline" as const,            label: "Lagre garasjemodeller" },
  { icon: "document-text-outline" as const,   label: "Se dine tilbud og søknader" },
  { icon: "notifications-outline" as const,   label: "Varsler om prosjektstatus" },
  { icon: "time-outline" as const,            label: "Historikk og bestillinger" },
];

export default function MinSideScreen() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [messeMode, setMesseMode] = useState(false);
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val: string | null) => {
      if (val === "messe") { setLoggedIn(true); setMesseMode(true); }
      setChecking(false);
    });
  }, []);

  async function loginMesse() {
    if (!password.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/messe-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
        credentials: "include",
      });
      if (res.ok) {
        await AsyncStorage.setItem(STORAGE_KEY, "messe");
        setLoggedIn(true);
        setMesseMode(true);
        setPassword("");
      } else {
        Alert.alert("Feil passord", "Prøv igjen.");
      }
    } catch {
      Alert.alert("Feil", "Ingen internettforbindelse.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setLoggedIn(false);
    setMesseMode(false);
    setPassword("");
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} />
      </View>
    );
  }

  if (loggedIn) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={32} color={Colors.orange} />
          </View>
          <Text style={styles.heroName}>{messeMode ? "Messedemo" : "Min konto"}</Text>
          {messeMode && <Text style={styles.heroSub}>Innlogget som messebruker</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tilgang</Text>
          {FEATURES.map((f, i) => (
            <View key={i} style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureBorder]}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={18} color={Colors.orange} />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Ionicons name="checkmark-circle" size={18} color={Colors.green} />
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={18} color={Colors.gray600} style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Logg ut</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircleLarge}>
            <Ionicons name="person-outline" size={44} color={Colors.gray400} />
          </View>
          <Text style={styles.notLoggedTitle}>Ikke innlogget</Text>
          <Text style={styles.notLoggedSub}>
            Logg inn for å lagre og hente dine garasjemodeller
          </Text>
        </View>

        {/* Features */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Med en konto kan du</Text>
          {FEATURES.map((f, i) => (
            <View key={i} style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureBorder]}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={18} color={Colors.orange} />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Messe login */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Messedemo</Text>
          <Text style={styles.messeInfo}>Har du messepassord? Logg inn for full tilgang.</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Passord"
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={loginMesse}
          />
          <TouchableOpacity
            style={[styles.loginBtn, (!password.trim() || loading) && { opacity: 0.5 }]}
            onPress={loginMesse}
            disabled={!password.trim() || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <>
                  <Ionicons name="log-in-outline" size={18} color={Colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.loginBtnText}>Logg inn</Text>
                </>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.gray50 },
  content:         { padding: 16, paddingBottom: 48, gap: 12 },
  center:          { flex: 1, justifyContent: "center", alignItems: "center" },
  hero:            { backgroundColor: Colors.orange, borderRadius: 14, padding: 20, alignItems: "center" },
  avatarCircle:    { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.orangeLight,
                     justifyContent: "center", alignItems: "center", marginBottom: 10 },
  heroName:        { fontSize: 20, fontWeight: "800", color: Colors.white },
  heroSub:         { fontSize: 13, color: "#ffedd5", marginTop: 4 },
  avatarSection:   { alignItems: "center", paddingVertical: 28 },
  avatarCircleLarge:{ width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.gray100,
                      justifyContent: "center", alignItems: "center", marginBottom: 16 },
  notLoggedTitle:  { fontSize: 20, fontWeight: "700", color: Colors.gray900, marginBottom: 8 },
  notLoggedSub:    { fontSize: 14, color: Colors.gray500, textAlign: "center",
                     lineHeight: 20, maxWidth: 280 },
  card:            { backgroundColor: Colors.white, borderRadius: 14, padding: 16,
                     borderWidth: 1, borderColor: Colors.gray200 },
  cardTitle:       { fontSize: 15, fontWeight: "700", color: Colors.gray900, marginBottom: 14 },
  featureRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  featureBorder:   { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  featureIcon:     { width: 34, height: 34, borderRadius: 8, backgroundColor: Colors.orangeLight,
                     justifyContent: "center", alignItems: "center", marginRight: 12 },
  featureLabel:    { flex: 1, fontSize: 14, color: Colors.gray800, fontWeight: "500" },
  messeInfo:       { fontSize: 13, color: Colors.gray500, marginBottom: 12 },
  input:           { borderWidth: 1, borderColor: Colors.gray200, borderRadius: 8,
                     paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
                     color: Colors.gray900, backgroundColor: Colors.gray50, marginBottom: 10 },
  loginBtn:        { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 13,
                     flexDirection: "row", justifyContent: "center", alignItems: "center" },
  loginBtnText:    { color: Colors.white, fontWeight: "700", fontSize: 15 },
  logoutBtn:       { borderRadius: 12, paddingVertical: 13, alignItems: "center",
                     flexDirection: "row", justifyContent: "center",
                     borderWidth: 1, borderColor: Colors.gray200, backgroundColor: Colors.white },
  logoutBtnText:   { color: Colors.gray600, fontWeight: "600", fontSize: 15 },
});
