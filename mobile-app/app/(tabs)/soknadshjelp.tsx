import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

const FAQ = [
  {
    q: "Trenger jeg alltid byggesøknad for garasje?",
    a: "Ikke nødvendigvis. Garasjer under 50 m² kan i noen tilfeller være unntatt søknadsplikt, men det avhenger av kommune, avstand til nabogrense og reguleringsplan.",
  },
  {
    q: "Hva koster søknadshjelp?",
    a: "Prisen varierer etter kompleksitet og kommunens krav. Vi gir deg et konkret tilbud etter en gratis gjennomgang av din sak.",
  },
  {
    q: "Hvor lang tid tar en byggesøknad?",
    a: "Kommunen har 12 ukers behandlingstid for søknadspliktige tiltak. Med nabovarsel går det gjerne 8–10 uker.",
  },
  {
    q: "Hva hjelper dere med?",
    a: "Vi tar oss av alt: situasjonskart, fasade- og plantegninger, nabovarsel, dispensasjonssøknad og innlevering til kommunen.",
  },
  {
    q: "Hva er søknadsfritt?",
    a: "Frittliggende garasje/carport under 50 m², maks mønehøyde 4 m og gesimshøyde 3 m, minst 1 m fra nabogrense og ikke i strid med reguleringsplan — kan i mange kommuner være unntatt søknadsplikt.",
  },
  {
    q: "Hva er dispensasjon?",
    a: "Dispensasjon søkes når tiltaket er i strid med reguleringsplan eller kommuneplan. Vi utarbeider dispensasjonssøknad der vi dokumenterer at fordelen er større enn ulempen.",
  },
];

const SERVICES = [
  { icon: "document-outline" as const,     label: "Situasjonskart", desc: "Kartutsnitt med mål og plassering" },
  { icon: "compass-outline" as const,      label: "Nabovarsel", desc: "Varsling av naboer med svarfrist" },
  { icon: "pencil-outline" as const,       label: "Tegninger", desc: "Fasade- og plantegninger i målestokk" },
  { icon: "git-branch-outline" as const,   label: "Dispensasjon", desc: "Søknad om avvik fra reguleringsplan" },
  { icon: "send-outline" as const,         label: "Innlevering", desc: "Komplett søknad til kommunen" },
];

export default function SoknadshjelScreen() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [email,   setEmail]   = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendRequest() {
    if (!name.trim() || !email.trim()) {
      Alert.alert("Mangler info", "Fyll ut navn og e-post.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("https://garasjeproffen.no/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(),
          phone: phone.trim(), message: message.trim() || "Søknadshjelp",
          source: "app-soknadshjelp",
        }),
      });
      if (res.ok) {
        Alert.alert("Takk!", "Vi tar kontakt med deg om søknadshjelp.", [
          { text: "OK", onPress: () => { setName(""); setEmail(""); setPhone(""); setMessage(""); } },
        ]);
      } else {
        Alert.alert("Feil", "Noe gikk galt. Ring oss på 476 17 563.");
      }
    } catch {
      Alert.alert("Feil", "Ingen internettforbindelse. Ring oss på 476 17 563.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <View style={styles.hero}>
          <Ionicons name="document-text-outline" size={36} color={Colors.white} style={{ marginBottom: 10 }} />
          <Text style={styles.heroTitle}>Søknadshjelp</Text>
          <Text style={styles.heroSub}>Vi hjelper deg med hele byggesøknadsprosessen</Text>
        </View>

        {/* Tjenester */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vi hjelper deg med</Text>
          {SERVICES.map((s, i) => (
            <View key={i} style={[styles.serviceRow, i < SERVICES.length - 1 && styles.serviceBorder]}>
              <View style={styles.serviceIcon}>
                <Ionicons name={s.icon} size={18} color={Colors.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceLabel}>{s.label}</Text>
                <Text style={styles.serviceDesc}>{s.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* FAQ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vanlige spørsmål</Text>
          {FAQ.map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setOpenFaq(openFaq === i ? null : i)}
              activeOpacity={0.75}
              style={[styles.faqItem, i < FAQ.length - 1 && styles.faqBorder]}
            >
              <View style={styles.faqRow}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Ionicons
                  name={openFaq === i ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={Colors.gray400}
                />
              </View>
              {openFaq === i && <Text style={styles.faqA}>{item.a}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Kontaktskjema */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Be om søknadshjelp</Text>
          <Text style={styles.formInfo}>Fortell oss kort om prosjektet ditt, så tar vi kontakt.</Text>

          <Text style={styles.inputLabel}>Navn *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ola Nordmann"
            autoCapitalize="words"
          />

          <Text style={styles.inputLabel}>E-post *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="ola@eksempel.no"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>Telefon</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+47 900 00 000"
            keyboardType="phone-pad"
          />

          <Text style={styles.inputLabel}>Beskriv prosjektet</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Garasje ca. 5×6 m, flatt tak, Stavanger kommune…"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={sendRequest}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.submitBtnText}>Send forespørsel</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          Ring 476 17 563 (Christian) eller 913 44 486 (Ola) for rask hjelp.
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content:   { padding: 16, paddingBottom: 48, gap: 12 },
  hero:      { backgroundColor: Colors.orange, borderRadius: 14, padding: 24, alignItems: "center" },
  heroTitle: { fontSize: 24, fontWeight: "800", color: Colors.white },
  heroSub:   { fontSize: 14, color: "#ffedd5", marginTop: 4, textAlign: "center" },
  card:      { backgroundColor: Colors.white, borderRadius: 14, padding: 16,
               borderWidth: 1, borderColor: Colors.gray200 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: Colors.gray900, marginBottom: 14 },
  serviceRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  serviceBorder:{ borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  serviceIcon:  { width: 34, height: 34, borderRadius: 8, backgroundColor: Colors.orangeLight,
                  justifyContent: "center", alignItems: "center", marginRight: 12 },
  serviceLabel: { fontSize: 14, fontWeight: "600", color: Colors.gray900 },
  serviceDesc:  { fontSize: 12, color: Colors.gray500, marginTop: 1 },
  faqItem:   { paddingVertical: 12 },
  faqBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  faqRow:    { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  faqQ:      { flex: 1, fontSize: 14, fontWeight: "600", color: Colors.gray900, lineHeight: 20 },
  faqA:      { marginTop: 6, fontSize: 13, color: Colors.gray600, lineHeight: 19 },
  formInfo:  { fontSize: 13, color: Colors.gray500, marginBottom: 12 },
  inputLabel:{ fontSize: 13, fontWeight: "600", color: Colors.gray700, marginBottom: 4, marginTop: 10 },
  input:     { borderWidth: 1, borderColor: Colors.gray200, borderRadius: 8,
               paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
               color: Colors.gray900, backgroundColor: Colors.white },
  textarea:  { height: 80, paddingTop: 10 },
  submitBtn: { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 14,
               alignItems: "center", marginTop: 14 },
  submitBtnText: { color: Colors.white, fontWeight: "700", fontSize: 15 },
  disclaimer:{ fontSize: 12, color: Colors.gray400, textAlign: "center", lineHeight: 18 },
});
