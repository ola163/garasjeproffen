import { useState } from "react";
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Switch,
  ScrollView, TextInput, SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

export interface GrunnarbeidData {
  utgraving: boolean;
  utgravingFra: string;
  utgravingTil: string;
  markisolering: boolean;
  betongdekke: boolean;
  fallGulv: boolean;
  helikopterpuss: boolean;
  betongtype: "B30" | "B35" | "B35MF45";
  ringmur: boolean;
  skillvegg: boolean;
  fjernAsfalt: boolean;
  masseutskiftning: boolean;
  reasfaltering: boolean;
  fyllingMur: boolean;
}

export function emptyGrunnarbeid(): GrunnarbeidData {
  return {
    utgraving: true, utgravingFra: "80", utgravingTil: "100",
    markisolering: false,
    betongdekke: true, fallGulv: false, helikopterpuss: false, betongtype: "B35",
    ringmur: true, skillvegg: false,
    fjernAsfalt: false, masseutskiftning: false, reasfaltering: false, fyllingMur: false,
  };
}

const STEPS = ["Grunnarbeid", "Betongarbeid", "Utomhus"];

interface Props {
  visible: boolean;
  sqm: number;
  initialData?: GrunnarbeidData;
  onSave: (data: GrunnarbeidData) => void;
  onClose: () => void;
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      <View style={styles.rowControl}>{children}</View>
    </View>
  );
}

function NumInput({ value, onChange, unit }: { value: string; onChange: (v: string) => void; unit?: string }) {
  return (
    <View style={styles.numWrap}>
      <TextInput
        style={styles.numInput}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        returnKeyType="done"
      />
      {unit && <Text style={styles.numUnit}>{unit}</Text>}
    </View>
  );
}

function BetongSegment({ value, onChange }: {
  value: GrunnarbeidData["betongtype"];
  onChange: (v: GrunnarbeidData["betongtype"]) => void;
}) {
  return (
    <View style={styles.betongRow}>
      {(["B30", "B35", "B35MF45"] as const).map((o) => (
        <TouchableOpacity
          key={o}
          style={[styles.betongBtn, value === o && styles.betongBtnActive]}
          onPress={() => onChange(o)}
          activeOpacity={0.7}
        >
          <Text style={[styles.betongLabel, value === o && styles.betongLabelActive]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function GrunnarbeidModal({ visible, sqm, initialData, onSave, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<GrunnarbeidData>(initialData ?? emptyGrunnarbeid());

  function set<K extends keyof GrunnarbeidData>(key: K, val: GrunnarbeidData[K]) {
    setD(prev => ({ ...prev, [key]: val }));
  }

  function handleSave() { onSave(d); onClose(); setStep(0); }
  function handleClose() { onClose(); setStep(0); }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Grunn- og betongarbeid</Text>
            <Text style={styles.headerSub}>{sqm.toFixed(1)} m² · Steg {step + 1} av {STEPS.length}</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.gray600} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          {STEPS.map((s, i) => (
            <TouchableOpacity
              key={s}
              style={[styles.tab, i === step && styles.tabActive, i < step && styles.tabDone]}
              onPress={() => { if (i <= step) setStep(i); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, i === step && styles.tabLabelActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 24 }}>

          {step === 0 && (
            <>
              <Text style={styles.stepHeading}>1. Grunnarbeid</Text>
              <Row label="Utgraving / masseutskiftning" sub="Dybde fra–til under terreng">
                <Switch value={d.utgraving} onValueChange={v => set("utgraving", v)}
                  trackColor={{ false: Colors.gray200, true: Colors.orange }} thumbColor={Colors.white} />
              </Row>
              {d.utgraving && (
                <View style={styles.subRow}>
                  <View style={styles.depthPair}>
                    <Text style={styles.depthLabel}>Fra</Text>
                    <NumInput value={d.utgravingFra} onChange={v => set("utgravingFra", v)} unit="cm" />
                  </View>
                  <View style={styles.depthPair}>
                    <Text style={styles.depthLabel}>Til</Text>
                    <NumInput value={d.utgravingTil} onChange={v => set("utgravingTil", v)} unit="cm" />
                  </View>
                </View>
              )}
              <Row label="Markisolering">
                <Switch value={d.markisolering} onValueChange={v => set("markisolering", v)}
                  trackColor={{ false: Colors.gray200, true: Colors.orange }} thumbColor={Colors.white} />
              </Row>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.stepHeading}>2. Betongarbeid</Text>
              <Row label="Betongdekke" sub={`${sqm.toFixed(1)} m²`}>
                <Switch value={d.betongdekke} onValueChange={v => set("betongdekke", v)}
                  trackColor={{ false: Colors.gray200, true: Colors.orange }} thumbColor={Colors.white} />
              </Row>
              <Row label="Fall i gulv 1:100">
                <Switch value={d.fallGulv} onValueChange={v => set("fallGulv", v)}
                  trackColor={{ false: Colors.gray200, true: Colors.orange }} thumbColor={Colors.white} />
              </Row>
              <Row label='Helikopterpuss ("stålglattet")'>
                <Switch value={d.helikopterpuss} onValueChange={v => set("helikopterpuss", v)}
                  trackColor={{ false: Colors.gray200, true: Colors.orange }} thumbColor={Colors.white} />
              </Row>
              <Row label="Betongtype">
                <BetongSegment value={d.betongtype} onChange={v => set("betongtype", v)} />
              </Row>
              <Row label="Ringmur" sub="H:25 cm · B:15 cm">
                <Switch value={d.ringmur} onValueChange={v => set("ringmur", v)}
                  trackColor={{ false: Colors.gray200, true: Colors.orange }} thumbColor={Colors.white} />
              </Row>
              <Row label="Innvendige skillevegger" sub="H:25 cm · B:10 cm">
                <Switch value={d.skillvegg} onValueChange={v => set("skillvegg", v)}
                  trackColor={{ false: Colors.gray200, true: Colors.orange }} thumbColor={Colors.white} />
              </Row>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.stepHeading}>3. Utomhusarbeider</Text>
              <Row label="Fjerning av eksisterende asfalt">
                <Switch value={d.fjernAsfalt} onValueChange={v => set("fjernAsfalt", v)}
                  trackColor={{ false: Colors.gray200, true: Colors.orange }} thumbColor={Colors.white} />
              </Row>
              <Row label="Masseutskiftning utenfor garasje">
                <Switch value={d.masseutskiftning} onValueChange={v => set("masseutskiftning", v)}
                  trackColor={{ false: Colors.gray200, true: Colors.orange }} thumbColor={Colors.white} />
              </Row>
              <Row label="Reasfaltering">
                <Switch value={d.reasfaltering} onValueChange={v => set("reasfaltering", v)}
                  trackColor={{ false: Colors.gray200, true: Colors.orange }} thumbColor={Colors.white} />
              </Row>
              <Row label="Fylling inntil mur">
                <Switch value={d.fyllingMur} onValueChange={v => set("fyllingMur", v)}
                  trackColor={{ false: Colors.gray200, true: Colors.orange }} thumbColor={Colors.white} />
              </Row>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.backBtn}
            onPress={() => step > 0 ? setStep(s => s - 1) : handleClose()} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>{step === 0 ? "Avbryt" : "← Tilbake"}</Text>
          </TouchableOpacity>
          {step < STEPS.length - 1 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(s => s + 1)} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Neste →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.nextBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Lagre</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.white },
  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  headerTitle:{ fontSize: 16, fontWeight: "700", color: Colors.gray900 },
  headerSub:  { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  closeBtn:   { padding: 6 },
  tabs:       { flexDirection: "row", padding: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  tab:        { flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: "center", backgroundColor: Colors.gray100 },
  tabActive:  { backgroundColor: Colors.orange },
  tabDone:    { backgroundColor: Colors.orangeLight },
  tabLabel:   { fontSize: 11, fontWeight: "600", color: Colors.gray500 },
  tabLabelActive: { color: Colors.white },
  content:    { flex: 1, padding: 16 },
  stepHeading:{ fontSize: 11, fontWeight: "700", color: Colors.gray400, letterSpacing: 0.5,
                textTransform: "uppercase", marginBottom: 12 },
  row:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  rowText:    { flex: 1, marginRight: 12 },
  rowLabel:   { fontSize: 14, color: Colors.gray800 },
  rowSub:     { fontSize: 11, color: Colors.gray400, marginTop: 1 },
  rowControl: { flexShrink: 0 },
  subRow:     { flexDirection: "row", gap: 16, backgroundColor: Colors.orangeLight,
                borderRadius: 8, padding: 10, marginBottom: 4 },
  depthPair:  { flexDirection: "row", alignItems: "center", gap: 6 },
  depthLabel: { fontSize: 12, color: Colors.gray600 },
  numWrap:    { flexDirection: "row", alignItems: "center", gap: 4 },
  numInput:   { width: 52, borderWidth: 1, borderColor: Colors.gray200, borderRadius: 6,
                paddingHorizontal: 6, paddingVertical: 5, fontSize: 14,
                textAlign: "right", color: Colors.gray900, backgroundColor: Colors.white },
  numUnit:    { fontSize: 12, color: Colors.gray500 },
  betongRow:  { flexDirection: "row", gap: 4 },
  betongBtn:  { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
                borderWidth: 1, borderColor: Colors.gray200, backgroundColor: Colors.white },
  betongBtnActive: { borderColor: Colors.orange, backgroundColor: Colors.orangeLight },
  betongLabel:{ fontSize: 11, fontWeight: "600", color: Colors.gray500 },
  betongLabelActive: { color: Colors.orange },
  footer:     { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.gray100 },
  backBtn:    { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: Colors.gray200,
                paddingVertical: 12, alignItems: "center" },
  backBtnText:{ fontSize: 14, color: Colors.gray600, fontWeight: "600" },
  nextBtn:    { flex: 2, borderRadius: 10, backgroundColor: Colors.orange, paddingVertical: 12, alignItems: "center" },
  nextBtnText:{ fontSize: 14, color: Colors.white, fontWeight: "700" },
});
