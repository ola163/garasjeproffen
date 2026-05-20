import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

const RULES = [
  {
    icon: "resize-outline" as const,
    title: "Avstand til nabogrense",
    desc: "Minst 1,0 m fra nabogrense (4,0 m for søknadsfri). Sjekk reguleringsplan for evt. strengere krav.",
  },
  {
    icon: "home-outline" as const,
    title: "Avstand til bolig",
    desc: "Garasjen bør ligge minst 1,0 m fra bolighuset, eller kobles med brandskille.",
  },
  {
    icon: "map-outline" as const,
    title: "BYA – bebygd areal",
    desc: "Garasjen teller med i BYA (%-BYA). Sjekk reguleringsplanen for maks tillatt utnyttelse på din tomt.",
  },
  {
    icon: "alert-circle-outline" as const,
    title: "Sone og reguleringsplan",
    desc: "LNF-soner, strandsone og kulturmiljø kan ha særlige restriksjoner. Se kommunens kartportal.",
  },
];

const TIPS = [
  "Merk av tomtegrenser på forhånd — bruk gjerne ePlan eller kartinnsyn.no",
  "Husk at takutstikk medregnes i avstandskravene",
  "Sjekk om det er vann eller avløp i grunnen — kontakt kommunen",
  "Solorientering: sørvendt åpning gir best lysforhold",
];

export default function PlasserScreen() {
  const [openRule, setOpenRule] = useState<number | null>(null);

  function openKartinnsyn() { Linking.openURL("https://www.kartverket.no/eiendom/"); }
  function openKommunekart() { Linking.openURL("https://kommunekart.com/"); }
  function openSoknadshjelp() { Linking.openURL("https://garasjeproffen.no/soknadshjelp"); }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Hero */}
      <View style={styles.hero}>
        <Ionicons name="map-outline" size={36} color={Colors.white} style={{ marginBottom: 10 }} />
        <Text style={styles.heroTitle}>Plasser garasjen</Text>
        <Text style={styles.heroSub}>Hva må du tenke på når du plasserer garasjen på tomten?</Text>
      </View>

      {/* Regler */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Viktige regler</Text>
        {RULES.map((rule, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.ruleRow, i < RULES.length - 1 && styles.ruleBorder]}
            onPress={() => setOpenRule(openRule === i ? null : i)}
            activeOpacity={0.75}
          >
            <View style={styles.ruleIconWrap}>
              <Ionicons name={rule.icon} size={20} color={Colors.orange} />
            </View>
            <View style={styles.ruleContent}>
              <View style={styles.ruleTitleRow}>
                <Text style={styles.ruleTitle}>{rule.title}</Text>
                <Ionicons
                  name={openRule === i ? "chevron-up" : "chevron-down"}
                  size={15}
                  color={Colors.gray400}
                />
              </View>
              {openRule === i && (
                <Text style={styles.ruleDesc}>{rule.desc}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tips */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Praktiske tips</Text>
        {TIPS.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <Ionicons name="checkmark-circle-outline" size={18} color={Colors.orange} style={{ marginTop: 1 }} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      {/* Kart-lenker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nyttige verktøy</Text>
        <TouchableOpacity style={styles.linkRow} onPress={openKartinnsyn} activeOpacity={0.7}>
          <View style={styles.linkIcon}>
            <Ionicons name="globe-outline" size={20} color={Colors.orange} />
          </View>
          <View style={styles.linkContent}>
            <Text style={styles.linkTitle}>Kartverket – eiendomsinformasjon</Text>
            <Text style={styles.linkSub}>Finn tomtegrenser og eiendomsdata</Text>
          </View>
          <Ionicons name="open-outline" size={15} color={Colors.gray400} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.linkRow} onPress={openKommunekart} activeOpacity={0.7}>
          <View style={styles.linkIcon}>
            <Ionicons name="map-outline" size={20} color={Colors.orange} />
          </View>
          <View style={styles.linkContent}>
            <Text style={styles.linkTitle}>Kommunekart</Text>
            <Text style={styles.linkSub}>Reguleringsplan, soner og bestemmelser</Text>
          </View>
          <Ionicons name="open-outline" size={15} color={Colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* CTA */}
      <TouchableOpacity style={styles.ctaBtn} onPress={openSoknadshjelp}>
        <Text style={styles.ctaBtnText}>Trenger du byggesøknad? Vi hjelper deg</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.gray50 },
  content:      { padding: 16, paddingBottom: 48, gap: 12 },
  hero:         { backgroundColor: Colors.orange, borderRadius: 14, padding: 24, alignItems: "center" },
  heroTitle:    { fontSize: 24, fontWeight: "800", color: Colors.white },
  heroSub:      { fontSize: 14, color: "#ffedd5", marginTop: 4, textAlign: "center" },
  card:         { backgroundColor: Colors.white, borderRadius: 14, padding: 16,
                  borderWidth: 1, borderColor: Colors.gray200 },
  cardTitle:    { fontSize: 15, fontWeight: "700", color: Colors.gray900, marginBottom: 14 },
  ruleRow:      { flexDirection: "row", alignItems: "flex-start", paddingVertical: 12 },
  ruleBorder:   { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  ruleIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.orangeLight,
                  justifyContent: "center", alignItems: "center", marginRight: 12, marginTop: 2 },
  ruleContent:  { flex: 1 },
  ruleTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ruleTitle:    { flex: 1, fontSize: 14, fontWeight: "600", color: Colors.gray900, marginRight: 8 },
  ruleDesc:     { marginTop: 6, fontSize: 13, color: Colors.gray600, lineHeight: 19 },
  tipRow:       { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
  tipText:      { flex: 1, fontSize: 14, color: Colors.gray700, lineHeight: 20 },
  linkRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  linkIcon:     { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.orangeLight,
                  justifyContent: "center", alignItems: "center", marginRight: 12 },
  linkContent:  { flex: 1 },
  linkTitle:    { fontSize: 14, fontWeight: "600", color: Colors.gray900 },
  linkSub:      { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  divider:      { height: 1, backgroundColor: Colors.gray100, marginVertical: 2 },
  ctaBtn:       { backgroundColor: Colors.gray900, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  ctaBtnText:   { color: Colors.white, fontWeight: "700", fontSize: 15 },
});
