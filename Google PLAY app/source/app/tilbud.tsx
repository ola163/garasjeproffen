import { useState } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import { formatPrice } from "@/lib/pricing";

const API_BASE = "https://garasjeproffen.no";

const BUILDING_LABELS: Record<string, string> = { garasje: "Garasje", carport: "Carport" };
const PACKAGE_LABELS:  Record<string, string> = { materialpakke: "Materialpakke", prefab: "Prefab m/montering" };
const ROOF_LABELS:     Record<string, string> = { saltak: "Saltak", flattak: "Flattak" };

export default function TilbudScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    buildingType: string; packageType: string; roofType: string;
    widthMm: string; lengthMm: string; totalPrice: string; manualQuote: string;
    soknadResult?: string;
  }>();

  const widthMm    = Number(params.widthMm);
  const lengthMm   = Number(params.lengthMm);
  const totalPrice = Number(params.totalPrice);
  const isManual   = params.manualQuote === "1";

  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [phone,   setPhone]   = useState("");
  const [message, setMessage] = useState(
    `Hei, jeg er interessert i en ${BUILDING_LABELS[params.buildingType] ?? ""} (${PACKAGE_LABELS[params.packageType] ?? ""}), ` +
    `${params.buildingType === "garasje" ? `${ROOF_LABELS[params.roofType] ?? ""}, ` : ""}` +
    `${(widthMm / 1000).toFixed(1)} m × ${(lengthMm / 1000).toFixed(1)} m.`,
  );
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim()) {
      Alert.alert("Mangler info", "Fyll ut navn og e-post.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        packageType:  params.packageType,
        roofType:     params.roofType,
        buildingType: params.buildingType,
        configuration: {
          parameters: { length: lengthMm, width: widthMm },
          timestamp: Date.now(),
        },
        pricing: {
          basePrice:   totalPrice,
          adjustments: [],
          totalPrice,
          currency:    "NOK",
          manualQuote: isManual,
        },
        customer: { name: name.trim(), email: email.trim(), phone: phone.trim(), message: message.trim() },
      };
      if (params.soknadResult && params.soknadResult !== "ubesvart") {
        body.soknadshjelp = { result: params.soknadResult, requested: true };
      }

      const res = await fetch(`${API_BASE}/api/quote`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert("Takk!", "Vi tar kontakt så snart som mulig.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Feil", data.error ?? "Noe gikk galt. Prøv igjen.");
      }
    } catch {
      Alert.alert("Feil", "Kunne ikke sende forespørsel. Sjekk internettforbindelsen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Oppsummering */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Din konfigurasjon</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Type</Text>
            <Text style={styles.summaryValue}>{BUILDING_LABELS[params.buildingType]}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tjeneste</Text>
            <Text style={styles.summaryValue}>{PACKAGE_LABELS[params.packageType]}</Text>
          </View>
          {params.buildingType === "garasje" && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tak</Text>
              <Text style={styles.summaryValue}>{ROOF_LABELS[params.roofType]}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Mål</Text>
            <Text style={styles.summaryValue}>
              {(widthMm / 1000).toFixed(1)} m × {(lengthMm / 1000).toFixed(1)} m
            </Text>
          </View>
          {!isManual && (
            <View style={[styles.summaryRow, styles.summaryTotalRow]}>
              <Text style={styles.summaryTotalLabel}>Prisestimat</Text>
              <Text style={styles.summaryTotalValue}>{formatPrice(totalPrice)}</Text>
            </View>
          )}
          {isManual && (
            <Text style={styles.manualNote}>Krever manuelt tilbud — vi regner ut pris for deg.</Text>
          )}
          {params.soknadResult === "søknad" || params.soknadResult === "usikkert" ? (
            <View style={[styles.summaryRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#fed7aa" }]}>
              <Text style={styles.summaryLabel}>Søknadshjelp</Text>
              <Text style={[styles.summaryValue, { color: Colors.orange }]}>Inkludert</Text>
            </View>
          ) : null}
        </View>

        {/* Kontaktskjema */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kontaktinfo</Text>

          <Text style={styles.label}>Navn *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ola Nordmann"
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={styles.label}>E-post *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="ola@eksempel.no"
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />

          <Text style={styles.label}>Telefon</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+47 900 00 000"
            keyboardType="phone-pad"
            returnKeyType="next"
          />

          <Text style={styles.label}>Melding</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={submit} disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitBtnText}>Send forespørsel</Text>}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Vi svarer normalt innen én arbeidsdag.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.gray50 },
  content:      { padding: 16, paddingBottom: 48, gap: 12 },
  card:         { backgroundColor: Colors.white, borderRadius: 12, padding: 16,
                  borderWidth: 1, borderColor: Colors.gray200 },
  cardTitle:    { fontSize: 15, fontWeight: "700", color: Colors.gray900, marginBottom: 12 },
  summaryCard:  { backgroundColor: Colors.orangeLight, borderRadius: 12, padding: 16,
                  borderWidth: 1, borderColor: "#fed7aa" },
  summaryTitle: { fontSize: 13, fontWeight: "700", color: Colors.orange, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: Colors.gray500 },
  summaryValue: { fontSize: 13, color: Colors.gray900, fontWeight: "600" },
  summaryTotalRow: { borderTopWidth: 1, borderTopColor: "#fed7aa", paddingTop: 8, marginTop: 4 },
  summaryTotalLabel: { fontSize: 14, fontWeight: "700", color: Colors.gray900 },
  summaryTotalValue: { fontSize: 18, fontWeight: "800", color: Colors.orange },
  manualNote:   { fontSize: 12, color: Colors.orange, marginTop: 6, fontStyle: "italic" },
  label:        { fontSize: 13, fontWeight: "600", color: Colors.gray700, marginBottom: 4, marginTop: 10 },
  input:        { borderWidth: 1, borderColor: Colors.gray200, borderRadius: 8,
                  paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
                  color: Colors.gray900, backgroundColor: Colors.white },
  textarea:     { height: 100, paddingTop: 10 },
  submitBtn:    { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 15,
                  alignItems: "center", marginTop: 4 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:     { color: Colors.white, fontWeight: "700", fontSize: 16 },
  disclaimer:   { fontSize: 12, color: Colors.gray400, textAlign: "center", lineHeight: 18, marginTop: 4 },
});
