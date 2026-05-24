import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/Colors";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!email || !password) {
      Alert.alert("Fyll inn e-post og passord");
      return;
    }
    setBusy(true);
    const err = mode === "login"
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);
    setBusy(false);

    if (err) {
      Alert.alert("Feil", err);
    } else if (mode === "signup") {
      Alert.alert("Registrert!", "Sjekk e-posten din for bekreftelse, logg inn etterpå.");
      setMode("login");
    } else {
      router.back();
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>{mode === "login" ? "Logg inn" : "Opprett konto"}</Text>
        <Text style={styles.sub}>Lagre og hent dine garasjemodeller</Text>

        <Text style={styles.label}>E-post</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="du@eksempel.no"
          placeholderTextColor={Colors.gray400}
        />

        <Text style={styles.label}>Passord</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Minst 6 tegn"
          placeholderTextColor={Colors.gray400}
        />

        <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={busy}>
          {busy
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.btnText}>{mode === "login" ? "Logg inn" : "Opprett konto"}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchBtn} onPress={() => setMode(mode === "login" ? "signup" : "login")}>
          <Text style={styles.switchText}>
            {mode === "login" ? "Ny bruker? Opprett konto" : "Har du konto? Logg inn"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.gray50, justifyContent: "center", padding: 20 },
  card:      { backgroundColor: Colors.white, borderRadius: 16, padding: 24,
               borderWidth: 1, borderColor: Colors.gray200 },
  title:     { fontSize: 22, fontWeight: "800", color: Colors.gray900, marginBottom: 4 },
  sub:       { fontSize: 14, color: Colors.gray500, marginBottom: 24 },
  label:     { fontSize: 13, fontWeight: "600", color: Colors.gray700, marginBottom: 6 },
  input:     { borderWidth: 1, borderColor: Colors.gray200, borderRadius: 10, padding: 12,
               fontSize: 15, color: Colors.gray900, marginBottom: 14 },
  btn:       { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 14,
               alignItems: "center", marginTop: 4 },
  btnText:   { color: Colors.white, fontWeight: "700", fontSize: 16 },
  switchBtn: { marginTop: 16, alignItems: "center" },
  switchText:{ fontSize: 14, color: Colors.orange, fontWeight: "500" },
});
