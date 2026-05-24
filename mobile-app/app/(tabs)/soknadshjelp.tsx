import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuildingType = "garasje" | "hagestue" | "verksted" | "pergola" | "hytte";
type Answer = "Ja" | "Nei" | "Vet ikke" | "";

interface DibkAnswers {
  frittstående: Answer;
  bya50: Answer;
  enEtasje: Answer;
  monehoyde: Answer;
  nabogrense: Answer;
  avstandBygg: Answer;
  ikkeVernet: Answer;
  ikkeFlom: Answer;
  lnf: Answer;
  kjeller: Answer;
}

const DEFAULT_ANSWERS: DibkAnswers = {
  frittstående: "", bya50: "", enEtasje: "", monehoyde: "",
  nabogrense: "", avstandBygg: "", ikkeVernet: "", ikkeFlom: "",
  lnf: "", kjeller: "",
};

const SØKNAD_KEYS: (keyof DibkAnswers)[] = [
  "frittstående", "bya50", "enEtasje", "monehoyde",
  "nabogrense", "avstandBygg", "ikkeVernet", "ikkeFlom",
];

type PermitResult = "søknadsfri" | "søknad" | "usikkert" | "ubesvart";

function permitResult(d: DibkAnswers): PermitResult {
  const allAnswered = Object.values(d).every((v) => v !== "");
  if (!allAnswered) return "ubesvart";
  if (SØKNAD_KEYS.some((k) => d[k] === "Nei") || d.lnf === "Ja" || d.kjeller === "Ja") return "søknad";
  if (Object.values(d).some((v) => v === "Vet ikke")) return "usikkert";
  return "søknadsfri";
}

function countDisp(d: DibkAnswers): number {
  return (d.lnf === "Ja" ? 1 : 0) + SØKNAD_KEYS.filter((k) => d[k] === "Nei").length;
}

function permitCost(d: DibkAnswers): number {
  const res = permitResult(d);
  if (res !== "søknad") return 0;
  const disp = countDisp(d);
  return disp > 0 ? 10_000 + Math.max(0, disp - 1) * 5_000 : 8_000;
}

function fmt(n: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency", currency: "NOK",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const BUILDING_TYPES: { id: BuildingType; label: string; icon: string }[] = [
  { id: "garasje",   label: "Garasje / carport",              icon: "car-outline" },
  { id: "hagestue",  label: "Hagestue / bod / drivhus",       icon: "leaf-outline" },
  { id: "verksted",  label: "Verksted / atelier / kontor",    icon: "construct-outline" },
  { id: "pergola",   label: "Frittliggende pergola",          icon: "sunny-outline" },
  { id: "hytte",     label: "Hytte / fritidsbolig / anneks",  icon: "home-outline" },
];

const QUESTIONS: { key: keyof DibkAnswers; q: string; hint?: string }[] = [
  { key: "frittstående", q: "Er bygningen frittliggende?",             hint: "Ikke festet til annen bygning" },
  { key: "bya50",        q: "Er grunnflaten (BYA) maks 50 m²?",       hint: "Inkludert veggtykkelse" },
  { key: "enEtasje",     q: "Har bygningen kun én etasje?" },
  { key: "monehoyde",    q: "Er mønehøyden maks 4 m?",                hint: "Flattak: gesimshøyde maks 3 m" },
  { key: "nabogrense",   q: "Er det mer enn 1 m til nabogrense?" },
  { key: "avstandBygg",  q: "Er det mer enn 8 m fra andre bygg på tomten?" },
  { key: "ikkeVernet",   q: "Er tomten ikke regulert til bevaring?",   hint: "Spør kommunen ved tvil" },
  { key: "ikkeFlom",     q: "Er eiendommen utenfor flom- og skredfare?" },
  { key: "lnf",          q: "Ligger eiendommen i LNF-område?",        hint: "Landbruk, Natur, Friluft" },
  { key: "kjeller",      q: "Har bygningen kjeller eller underetasje?" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBtn({ id, label, icon, selected, onPress }: {
  id: BuildingType; label: string; icon: string;
  selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.typeBtn, selected && styles.typeBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={22}
        color={selected ? Colors.orange : Colors.gray500}
      />
      <Text style={[styles.typeBtnLabel, selected && styles.typeBtnLabelActive]}>{label}</Text>
      {selected && <Ionicons name="checkmark-circle" size={18} color={Colors.orange} style={{ marginLeft: "auto" }} />}
    </TouchableOpacity>
  );
}

function QuestionRow({ question, hint, answer, onChange }: {
  question: string; hint?: string;
  answer: Answer; onChange: (a: Answer) => void;
}) {
  return (
    <View style={styles.questionWrap}>
      <Text style={styles.questionText}>{question}</Text>
      {hint ? <Text style={styles.questionHint}>{hint}</Text> : null}
      <View style={styles.pillRow}>
        {(["Ja", "Nei", "Vet ikke"] as Answer[]).map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.pill, answer === opt && pillActive(opt)]}
            onPress={() => onChange(opt)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, answer === opt && pillTextActive(opt)]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ResultBanner({ result, cost }: { result: PermitResult; cost: number }) {
  if (result === "ubesvart") return null;

  const configs = {
    søknadsfri: {
      bg: "#f0fdf4", border: "#86efac", icon: "checkmark-circle" as const,
      iconColor: "#16a34a", title: "Kan trolig bygges uten søknad",
      body: "Basert på svarene ser dette ut til å være søknadsfritt etter pbl. § 20-5. Vi anbefaler likevel å bekrefte med kommunen.",
    },
    søknad: {
      bg: "#fef2f2", border: "#fca5a5", icon: "warning" as const,
      iconColor: "#dc2626", title: "Byggesøknad er trolig nødvendig",
      body: "Ett eller flere krav for søknadsfri bygning er ikke oppfylt. GarasjeProffen kan hjelpe deg med søknaden.",
    },
    usikkert: {
      bg: "#fffbeb", border: "#fcd34d", icon: "help-circle" as const,
      iconColor: "#d97706", title: "Vi anbefaler å avklare med kommunen",
      body: "Du har svart «Vet ikke» på ett eller flere punkter. Ta kontakt med kommunen eller oss for avklaring.",
    },
  };

  const cfg = configs[result];

  return (
    <View style={[styles.resultBanner, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={styles.resultHeader}>
        <Ionicons name={cfg.icon} size={22} color={cfg.iconColor} />
        <Text style={[styles.resultTitle, { color: cfg.iconColor }]}>{cfg.title}</Text>
      </View>
      <Text style={styles.resultBody}>{cfg.body}</Text>
      {result === "søknad" && cost > 0 && (
        <View style={styles.costRow}>
          <Text style={styles.costLabel}>Søknadshjelp fra GarasjeProffen</Text>
          <Text style={styles.costValue}>fra {fmt(cost)}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SoknadshjelScreen() {
  const [buildingType, setBuildingType] = useState<BuildingType | null>(null);
  const [answers, setAnswers] = useState<DibkAnswers>(DEFAULT_ANSWERS);
  const [showQuestions, setShowQuestions] = useState(false);

  function setAnswer(key: keyof DibkAnswers, val: Answer) {
    setAnswers((prev) => ({ ...prev, [key]: val }));
  }

  const result = showQuestions ? permitResult(answers) : "ubesvart";
  const cost   = permitCost(answers);
  const answeredCount = Object.values(answers).filter((v) => v !== "").length;

  function reset() {
    setBuildingType(null);
    setAnswers(DEFAULT_ANSWERS);
    setShowQuestions(false);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.hero}>
        <Ionicons name="document-text-outline" size={28} color={Colors.white} style={{ marginBottom: 8 }} />
        <Text style={styles.heroTitle}>Søknadshjelp</Text>
        <Text style={styles.heroSub}>Trenger du byggesøknad? Vi hjelper deg.</Text>
      </View>

      {/* Step 1: Bygningstype */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Steg 1 — Hva skal du bygge?</Text>
        {BUILDING_TYPES.map((bt) => (
          <TypeBtn
            key={bt.id}
            {...bt}
            selected={buildingType === bt.id}
            onPress={() => setBuildingType(bt.id)}
          />
        ))}
        {buildingType && !showQuestions && (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => setShowQuestions(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.nextBtnText}>Sjekk søknadskrav →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Step 2: DIBK-spørsmål */}
      {showQuestions && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Steg 2 — Søknadskrav</Text>
            <Text style={styles.progressText}>{answeredCount}/{QUESTIONS.length}</Text>
          </View>
          <Text style={styles.cardSub}>
            Basert på plan- og bygningsloven § 20-5 (søknadsfrie tiltak)
          </Text>
          {QUESTIONS.map((q) => (
            <QuestionRow
              key={q.key}
              question={q.q}
              hint={q.hint}
              answer={answers[q.key]}
              onChange={(a) => setAnswer(q.key, a)}
            />
          ))}
        </View>
      )}

      {/* Resultat */}
      {showQuestions && (
        <ResultBanner result={result} cost={cost} />
      )}

      {/* CTA */}
      {showQuestions && (result === "søknad" || result === "usikkert") && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vil du ha hjelp?</Text>
          <Text style={styles.ctaBody}>
            GarasjeProffen bistår med situasjonsplan, tegninger og innsending til kommunen.
          </Text>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => Linking.openURL("tel:+4747617563")}
            activeOpacity={0.8}
          >
            <Ionicons name="call-outline" size={18} color={Colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.ctaBtnText}>Ring oss: 476 17 563</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ctaBtn, styles.ctaBtnSecondary]}
            onPress={() => Linking.openURL("mailto:post@garasjeproffen.no?subject=Søknadshjelp")}
            activeOpacity={0.8}
          >
            <Ionicons name="mail-outline" size={18} color={Colors.orange} style={{ marginRight: 8 }} />
            <Text style={[styles.ctaBtnText, { color: Colors.orange }]}>Send e-post</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reset */}
      {showQuestions && (
        <TouchableOpacity onPress={reset} style={styles.resetBtn}>
          <Text style={styles.resetText}>Start på nytt</Text>
        </TouchableOpacity>
      )}

      {/* FAQ */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Vanlige spørsmål</Text>
        {[
          {
            q: "Trenger jeg alltid byggesøknad for garasje?",
            a: "Ikke nødvendigvis. Garasjer under 50 m² kan i mange tilfeller bygges uten søknad, men det avhenger av kommunens reguleringsplan og plassering.",
          },
          {
            q: "Hva koster søknadshjelp?",
            a: "Enkel søknad uten dispensasjon koster fra kr 8 000. Behøves det dispensasjon, starter prisen på kr 10 000.",
          },
          {
            q: "Hvor lang tid tar kommunen?",
            a: "Kommunen har 12 ukers frist etter plan- og bygningsloven. Mange kommuner behandler enklere garasjesøknader raskere.",
          },
          {
            q: "Kan dere sende søknaden for meg?",
            a: "Ja, vi kan stå som ansvarlig søker og håndtere all kommunikasjon med kommunen.",
          },
        ].map((item) => (
          <View key={item.q} style={styles.faqItem}>
            <Text style={styles.faqQ}>{item.q}</Text>
            <Text style={styles.faqA}>{item.a}</Text>
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

function pillActive(opt: Answer) {
  return {
    borderColor: opt === "Ja" ? "#16a34a" : opt === "Nei" ? "#dc2626" : "#d97706",
    backgroundColor: opt === "Ja" ? "#f0fdf4" : opt === "Nei" ? "#fef2f2" : "#fffbeb",
  };
}
function pillTextActive(opt: Answer) {
  return { color: opt === "Ja" ? "#16a34a" : opt === "Nei" ? "#dc2626" : "#d97706", fontWeight: "700" as const };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content:   { padding: 16, paddingBottom: 48, gap: 12 },

  hero:      { backgroundColor: Colors.orange, borderRadius: 12, padding: 20, alignItems: "center" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: Colors.white },
  heroSub:   { fontSize: 14, color: "#ffedd5", marginTop: 4 },

  card:         { backgroundColor: Colors.white, borderRadius: 12, padding: 16,
                  borderWidth: 1, borderColor: Colors.gray200 },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTitle:    { fontSize: 14, fontWeight: "700", color: Colors.gray900, marginBottom: 10 },
  cardSub:      { fontSize: 12, color: Colors.gray500, marginBottom: 14, lineHeight: 17 },
  progressText: { fontSize: 12, color: Colors.gray400 },

  typeBtn:           { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
                       paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
                       borderColor: Colors.gray200, marginBottom: 6, backgroundColor: Colors.gray50 },
  typeBtnActive:     { borderColor: Colors.orange, backgroundColor: "#fff7ed" },
  typeBtnLabel:      { flex: 1, fontSize: 14, color: Colors.gray700, fontWeight: "500" },
  typeBtnLabelActive:{ color: Colors.orange, fontWeight: "600" },

  nextBtn:     { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 13,
                 alignItems: "center", marginTop: 8 },
  nextBtnText: { color: Colors.white, fontWeight: "700", fontSize: 15 },

  questionWrap: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  questionText: { fontSize: 14, fontWeight: "600", color: Colors.gray800, marginBottom: 2 },
  questionHint: { fontSize: 12, color: Colors.gray400, marginBottom: 8 },
  pillRow:      { flexDirection: "row", gap: 8, marginTop: 8 },
  pill:         { flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1,
                  borderColor: Colors.gray200, alignItems: "center", backgroundColor: Colors.gray50 },
  pillText:     { fontSize: 13, color: Colors.gray500, fontWeight: "500" },

  resultBanner: { borderRadius: 12, padding: 16, borderWidth: 1.5 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  resultTitle:  { fontSize: 15, fontWeight: "700", flex: 1 },
  resultBody:   { fontSize: 13, color: Colors.gray600, lineHeight: 19 },
  costRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                  marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#fca5a5" },
  costLabel:    { fontSize: 13, color: Colors.gray700, flex: 1 },
  costValue:    { fontSize: 15, fontWeight: "800", color: Colors.orange },

  ctaBody:          { fontSize: 13, color: Colors.gray500, lineHeight: 19, marginBottom: 12 },
  ctaBtn:           { flexDirection: "row", backgroundColor: Colors.orange, borderRadius: 10,
                      paddingVertical: 13, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  ctaBtnSecondary:  { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.orange },
  ctaBtnText:       { color: Colors.white, fontWeight: "700", fontSize: 15 },

  resetBtn:  { alignItems: "center", paddingVertical: 8 },
  resetText: { fontSize: 14, color: Colors.gray400 },

  faqItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  faqQ:    { fontSize: 14, fontWeight: "600", color: Colors.gray800, marginBottom: 4 },
  faqA:    { fontSize: 13, color: Colors.gray500, lineHeight: 19 },
});
