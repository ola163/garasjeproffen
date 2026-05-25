import { useState, useMemo, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Switch,
  StyleSheet, Platform, Pressable, Alert, TextInput, Modal, ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import { calculatePrice, formatPrice } from "@/lib/pricing";
import type { PackageType, RoofType, BuildingType } from "@/lib/pricing";
import GarageViewer3D from "@/components/GarageViewer3D";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import GrunnarbeidModal, { type GrunnarbeidData, emptyGrunnarbeid } from "@/components/GrunnarbeidModal";
import { useConfig } from "@/context/ConfigContext";

const WIDTH_MIN  = 2400;
const WIDTH_MAX  = 8000;
const LENGTH_MIN = 2400;
const LENGTH_MAX = 8400;

function snapWidth(v: number)  { return Math.max(2600, Math.min(8000, Math.round((v - 200) / 600) * 600 + 200)); }
function snapLength(v: number) { return Math.max(2400, Math.min(8400, Math.round(v / 600) * 600)); }
function isWidthSnapped(v: number)  { return (v - 200) % 600 === 0; }
function isLengthSnapped(v: number) { return v % 600 === 0; }

const ALL_DOOR_WIDTHS = [2500, 3000, 5000] as const;
const MIN_CLEARANCE_MM = 300;

type WallId   = "forvegg" | "bakvegg" | "venstre" | "høyre";
type ElemType = "vindu" | "garasjedør" | "inngangsdør";
const WALLS: { id: WallId; label: string }[] = [
  { id: "forvegg",  label: "Forvegg"  },
  { id: "bakvegg",  label: "Bakvegg"  },
  { id: "venstre",  label: "Venstre"  },
  { id: "høyre",    label: "Høyre"    },
];
const ELEM_TYPES: { id: ElemType; label: string }[] = [
  { id: "vindu",       label: "Vindu"        },
  { id: "garasjedør",  label: "Garasjedør"   },
  { id: "inngangsdør", label: "Inngangsdør"  },
];
const DOOR_COLORS: { id: string; label: string; hex: string }[] = [
  { id: "hvit",      label: "Hvit",      hex: "#ffffff" },
  { id: "antrasitt", label: "Antrasitt", hex: "#374151" },
  { id: "annet",     label: "Annet",     hex: "#9ca3af" },
];

function SegmentControl<T extends string>({
  options, value, onChange, labels,
}: { options: T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <View style={styles.segment}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          style={[styles.segmentBtn, value === opt && styles.segmentBtnActive]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.segmentLabel, value === opt && styles.segmentLabelActive]}>
            {labels?.[opt] ?? opt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function DimensionRow({
  label, valueMm, minMm, maxMm, step, snapped, snapOnly,
  onChange,
}: {
  label: string; valueMm: number; minMm: number; maxMm: number; step: number;
  snapped: boolean; snapOnly: boolean; onChange: (v: number) => void;
}) {
  const displayM = (valueMm / 1000).toFixed(1);
  return (
    <View style={styles.dimRow}>
      <View style={styles.dimLabelRow}>
        <Text style={styles.dimLabel}>{label}</Text>
        <View style={dimValueBadge(snapped)}>
          <Text style={dimValueText(snapped)}>{displayM} m</Text>
        </View>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={minMm}
        maximumValue={maxMm}
        step={step}
        value={valueMm}
        onValueChange={onChange}
        minimumTrackTintColor={snapped ? Colors.green : Colors.orange}
        maximumTrackTintColor={Colors.gray200}
        thumbTintColor={snapped ? Colors.green : Colors.orange}
      />
      <View style={styles.dimRangeRow}>
        <Text style={styles.dimRange}>{(minMm / 1000).toFixed(1)} m</Text>
        <Text style={styles.dimRange}>{(maxMm / 1000).toFixed(1)} m</Text>
      </View>
    </View>
  );
}

export default function KonfiguratorScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { setConfig } = useConfig();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const [buildingType, setBuildingType] = useState<BuildingType>("garasje");
  const [packageType,  setPackageType]  = useState<PackageType>("materialpakke");
  const [roofType,     setRoofType]     = useState<RoofType>("saltak");
  const [widthMm,      setWidthMm]      = useState(5000);
  const [lengthMm,     setLengthMm]     = useState(6000);
  const [snapOnly,     setSnapOnly]     = useState(false);
  const [saveModal,    setSaveModal]    = useState(false);
  const [saveName,     setSaveName]     = useState("");
  const [saving,       setSaving]       = useState(false);

  // Door
  const [doorWidthMm,  setDoorWidthMm]  = useState<number>(2500);
  const [doorColor,    setDoorColor]    = useState("hvit");

  // Wall elements
  const [wallElems, setWallElems] = useState<Record<WallId, ElemType[]>>({
    forvegg: [], bakvegg: [], venstre: [], høyre: [],
  });

  // Grunnarbeid
  const [grunnData,   setGrunnData]   = useState<GrunnarbeidData>(emptyGrunnarbeid());
  const [grunnModal,  setGrunnModal]  = useState(false);
  const [soknadModal, setSoknadModal] = useState(false);

  // Sync to ConfigContext so Plasser-tab picks up current dimensions
  useEffect(() => {
    setConfig({
      buildingType, packageType, roofType, widthMm, lengthMm, doorWidthMm, doorColor,
      totalPrice: pricing.totalPrice, manualQuote: pricing.manualQuote,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingType, packageType, roofType, widthMm, lengthMm, doorWidthMm, doorColor]);

  async function handleSave() {
    if (!saveName.trim()) { Alert.alert("Gi konfigurasjonen et navn"); return; }
    setSaving(true);
    const { error } = await supabase.from("saved_configs").insert({
      user_id: user!.id,
      name: saveName.trim(),
      config: { packageType, roofType, length: lengthMm, width: widthMm },
    });
    setSaving(false);
    if (error) { Alert.alert("Feil", error.message); return; }
    setSaveModal(false);
    setSaveName("");
    Alert.alert("Lagret!", "Finner den under «Min side».");
  }

  const widthStep  = snapOnly ? 600 : 100;
  const widthMin   = snapOnly ? 2600 : WIDTH_MIN;
  const lengthStep = snapOnly ? 600 : 100;

  function handleSnapToggle(val: boolean) {
    if (val) {
      setWidthMm(snapWidth(widthMm));
      setLengthMm(snapLength(lengthMm));
    }
    setSnapOnly(val);
  }

  function handleWidthChange(v: number) {
    setWidthMm(snapOnly ? snapWidth(v) : Math.round(v / 100) * 100);
  }

  function handleLengthChange(v: number) {
    setLengthMm(snapOnly ? snapLength(v) : Math.round(v / 100) * 100);
  }

  const pricing = useMemo(
    () => calculatePrice(lengthMm, widthMm, packageType, roofType, buildingType),
    [lengthMm, widthMm, packageType, roofType, buildingType],
  );

  const validDoorWidths = useMemo(
    () => ALL_DOOR_WIDTHS.filter(w => widthMm >= w + MIN_CLEARANCE_MM),
    [widthMm],
  );

  useEffect(() => {
    if (validDoorWidths.length > 0 && !validDoorWidths.includes(doorWidthMm as typeof ALL_DOOR_WIDTHS[number])) {
      setDoorWidthMm(validDoorWidths[validDoorWidths.length - 1]);
    }
  }, [validDoorWidths]);  // eslint-disable-line react-hooks/exhaustive-deps

  function toggleWallElem(wall: WallId, elem: ElemType) {
    setWallElems(prev => {
      const cur = prev[wall];
      const next = cur.includes(elem) ? cur.filter(e => e !== elem) : [...cur, elem];
      return { ...prev, [wall]: next };
    });
  }

  const wSnapped = buildingType === "garasje" && isWidthSnapped(widthMm);
  const lSnapped = buildingType === "garasje" && isLengthSnapped(lengthMm);

  return (
    <View style={{ flex: 1, flexDirection: isLandscape ? "row" : "column" }}>
    {/* Landscape: 3D viewer on the LEFT — fills full height */}
    {isLandscape && (
      <View style={{ flex: 1, backgroundColor: "#1a2535" }}>
        <GarageViewer3D
          widthMm={widthMm} lengthMm={lengthMm} roofType={roofType} buildingType={buildingType}
          containerStyle={{ flex: 1, height: undefined, borderRadius: 0 }}
        />
      </View>
    )}
    <ScrollView
      style={[styles.container, isLandscape && { width: 240, flex: 0 }]}
      contentContainerStyle={styles.content}
    >
      {/* Portrait: 3D viewer at top */}
      {!isLandscape && (
        <GarageViewer3D widthMm={widthMm} lengthMm={lengthMm} roofType={roofType} buildingType={buildingType} />
      )}

      {/* Bygningstype */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hva vil du bygge?</Text>
        <SegmentControl
          options={["garasje", "carport"] as BuildingType[]}
          value={buildingType}
          onChange={setBuildingType}
          labels={{ garasje: "Garasje", carport: "Carport" }}
        />
      </View>

      {/* Pakke */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tjeneste</Text>
        <SegmentControl
          options={["materialpakke", "prefab"] as PackageType[]}
          value={packageType}
          onChange={setPackageType}
          labels={{ materialpakke: "Materialpakke", prefab: "Prefab m/montering" }}
        />
        <Text style={styles.hint}>
          {packageType === "materialpakke"
            ? "Komplett materialpakke – du bygger selv eller bruker egne håndverkere."
            : "Ferdig montert garasje – vi leverer og setter opp alt."}
        </Text>
      </View>

      {/* Taktype (kun garasje) */}
      {buildingType === "garasje" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Taktype</Text>
          <SegmentControl
            options={["saltak", "flattak"] as RoofType[]}
            value={roofType}
            onChange={setRoofType}
            labels={{ saltak: "Saltak", flattak: "Flattak" }}
          />
        </View>
      )}

      {/* Dimensjoner */}
      <View style={styles.card}>
        <View style={styles.dimHeader}>
          <Text style={styles.cardTitle}>Mål</Text>
          {buildingType === "garasje" && (
            <View style={styles.snapRow}>
              <Text style={styles.snapLabel}>Lås til standard mål</Text>
              <Switch
                value={snapOnly}
                onValueChange={handleSnapToggle}
                trackColor={{ false: Colors.gray200, true: Colors.green }}
                thumbColor={Colors.white}
              />
            </View>
          )}
        </View>
        {snapOnly && (
          <View style={styles.snapBanner}>
            <Text style={styles.snapBannerText}>Standard mål gir opptil 10% rabatt</Text>
          </View>
        )}
        <DimensionRow
          label="Bredde"
          valueMm={widthMm}
          minMm={widthMin}
          maxMm={WIDTH_MAX}
          step={widthStep}
          snapped={wSnapped}
          snapOnly={snapOnly}
          onChange={handleWidthChange}
        />
        <DimensionRow
          label="Lengde"
          valueMm={lengthMm}
          minMm={LENGTH_MIN}
          maxMm={LENGTH_MAX}
          step={lengthStep}
          snapped={lSnapped}
          snapOnly={snapOnly}
          onChange={handleLengthChange}
        />
        <Text style={styles.areaText}>
          Areal: {((widthMm / 1000) * (lengthMm / 1000)).toFixed(1)} m²
        </Text>
      </View>

      {/* Garasjeport */}
      {buildingType === "garasje" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Garasjeport</Text>
          {validDoorWidths.length === 0 ? (
            <Text style={styles.hint}>Bredden er for liten for en standard garasjeport (min {(ALL_DOOR_WIDTHS[0] + MIN_CLEARANCE_MM) / 1000} m).</Text>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Bredde</Text>
              <View style={styles.doorWidthRow}>
                {validDoorWidths.map(w => (
                  <TouchableOpacity
                    key={w}
                    style={[styles.doorWidthBtn, doorWidthMm === w && styles.doorWidthBtnActive]}
                    onPress={() => setDoorWidthMm(w)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.doorWidthLabel, doorWidthMm === w && styles.doorWidthLabelActive]}>
                      {(w / 1000).toFixed(1)} m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Farge</Text>
              <View style={styles.colorRow}>
                {DOOR_COLORS.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.colorBtn, doorColor === c.id && styles.colorBtnActive]}
                    onPress={() => setDoorColor(c.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.colorSwatch, { backgroundColor: c.hex, borderWidth: c.id === "hvit" ? 1 : 0, borderColor: Colors.gray200 }]} />
                    <Text style={[styles.colorLabel, doorColor === c.id && styles.colorLabelActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* Dør og vindu */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dør og vindu</Text>
        {WALLS.map(wall => (
          <View key={wall.id} style={styles.wallRow}>
            <Text style={styles.wallLabel}>{wall.label}</Text>
            <View style={styles.elemRow}>
              {ELEM_TYPES.map(et => {
                const active = wallElems[wall.id].includes(et.id);
                return (
                  <TouchableOpacity
                    key={et.id}
                    style={[styles.elemBtn, active && styles.elemBtnActive]}
                    onPress={() => toggleWallElem(wall.id, et.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.elemLabel, active && styles.elemLabelActive]}>{et.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      {/* Grunnarbeid */}
      <TouchableOpacity style={styles.grunnBtn} onPress={() => setGrunnModal(true)} activeOpacity={0.8}>
        <View style={styles.grunnBtnInner}>
          <Ionicons name="construct-outline" size={20} color={Colors.orange} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.grunnBtnTitle}>Grunn- og betongarbeid</Text>
            <Text style={styles.grunnBtnSub}>
              {grunnData.betongdekke || grunnData.utgraving
                ? "Konfigurert – trykk for å endre"
                : "Trykk for å konfigurere"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
        </View>
      </TouchableOpacity>

      {/* Prisestimat */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Prisestimat</Text>

        {pricing.manualQuote ? (
          <Text style={styles.manualText}>
            Dimensjonene du har valgt krever et{" "}
            <Text style={{ fontWeight: "700" }}>manuelt tilbud</Text>.
          </Text>
        ) : (
          <>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Grunnpris</Text>
              <Text style={styles.priceValue}>{formatPrice(pricing.basePrice)}</Text>
            </View>
            {pricing.adjustments.map((adj) => (
              <View key={adj.label} style={styles.priceRow}>
                <Text style={styles.priceLabel}>{adj.label}</Text>
                <Text style={[styles.priceValue, adj.amount < 0 && styles.priceGreen]}>
                  {formatPrice(adj.amount)}
                </Text>
              </View>
            ))}
            <View style={styles.priceTotalRow}>
              <Text style={styles.priceTotalLabel}>Totalt</Text>
              <Text style={styles.priceTotalValue}>{formatPrice(pricing.totalPrice)}</Text>
            </View>
            <Text style={styles.priceDisclaimer}>* Estimert pris. Endelig tilbud kan variere.</Text>
          </>
        )}

        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => {
            if (buildingType === "garasje") {
              setSoknadModal(true);
            } else {
              router.push({
                pathname: "/tilbud",
                params: {
                  buildingType, packageType, roofType,
                  widthMm: String(widthMm), lengthMm: String(lengthMm),
                  totalPrice: String(pricing.totalPrice),
                  manualQuote: pricing.manualQuote ? "1" : "0",
                },
              });
            }
          }}
        >
          <Text style={styles.ctaBtnText}>Be om tilbud</Text>
        </TouchableOpacity>

        {user ? (
          <TouchableOpacity style={styles.saveBtn} onPress={() => setSaveModal(true)}>
            <Text style={styles.saveBtnText}>Lagre konfigurasjon</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.saveBtn} onPress={() => router.push("/login")}>
            <Text style={styles.saveBtnText}>Logg inn for å lagre</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Søknadshjelp-spørsmål før tilbud */}
      <Modal visible={soknadModal} transparent animationType="fade" onRequestClose={() => setSoknadModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="document-text-outline" size={32} color={Colors.orange} style={{ alignSelf: "center", marginBottom: 12 }} />
            <Text style={styles.modalTitle}>Trenger du søknadshjelp?</Text>
            <Text style={[styles.modalInput, { borderWidth: 0, color: Colors.gray500, fontSize: 14, lineHeight: 20, marginBottom: 16 }]}>
              Vil du sjekke om du trenger byggesøknad for garasjen?
            </Text>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => { setSoknadModal(false); router.push("/(tabs)/soknadshjelp"); }}
            >
              <Text style={styles.ctaBtnText}>Ja, sjekk søknadskrav</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { marginTop: 8 }]}
              onPress={() => {
                setSoknadModal(false);
                router.push({
                  pathname: "/tilbud",
                  params: {
                    buildingType, packageType, roofType,
                    widthMm: String(widthMm), lengthMm: String(lengthMm),
                    totalPrice: String(pricing.totalPrice),
                    manualQuote: pricing.manualQuote ? "1" : "0",
                  },
                });
              }}
            >
              <Text style={styles.saveBtnText}>Nei, gå direkte til tilbud</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <GrunnarbeidModal
        visible={grunnModal}
        sqm={(widthMm / 1000) * (lengthMm / 1000)}
        initialData={grunnData}
        onSave={setGrunnData}
        onClose={() => setGrunnModal(false)}
      />

      {/* Save modal */}
      <Modal visible={saveModal} transparent animationType="fade" onRequestClose={() => setSaveModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lagre konfigurasjon</Text>
            <TextInput
              style={styles.modalInput}
              value={saveName}
              onChangeText={setSaveName}
              placeholder="Gi den et navn, f.eks. «Dobbel garasje»"
              placeholderTextColor={Colors.gray400}
              autoFocus
            />
            <TouchableOpacity style={styles.ctaBtn} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.ctaBtnText}>Lagre</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={() => setSaveModal(false)}>
              <Text style={styles.saveBtnText}>Avbryt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
}

function dimValueBadge(snapped: boolean) {
  return { backgroundColor: snapped ? "#f0fdf4" : Colors.orangeLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 } as const;
}
function dimValueText(snapped: boolean) {
  return { fontSize: 13, fontWeight: "700" as const, color: snapped ? Colors.green : Colors.orange };
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.gray50 },
  content:    { padding: 16, paddingBottom: 40, gap: 12 },
  card:       { backgroundColor: Colors.white, borderRadius: 12, padding: 16,
                borderWidth: 1, borderColor: Colors.gray200 },
  cardTitle:  { fontSize: 15, fontWeight: "700", color: Colors.gray900, marginBottom: 12 },
  hint:       { marginTop: 8, fontSize: 12, color: Colors.gray500, lineHeight: 17 },
  segment:    { flexDirection: "row", backgroundColor: Colors.gray100,
                borderRadius: 8, padding: 3, gap: 3 },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: "center" },
  segmentBtnActive: { backgroundColor: Colors.white, ...Platform.select({
    ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
               shadowOpacity: 0.12, shadowRadius: 2 },
    android: { elevation: 2 },
  }) },
  segmentLabel:       { fontSize: 13, color: Colors.gray500, fontWeight: "500" },
  segmentLabelActive: { color: Colors.gray900, fontWeight: "700" },
  dimHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  snapRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  snapLabel:  { fontSize: 12, color: Colors.gray700, fontWeight: "500" },
  snapBanner: { backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 10,
                paddingVertical: 6, marginBottom: 12 },
  snapBannerText: { fontSize: 12, color: Colors.green, fontWeight: "600" },
  dimRow:     { marginBottom: 8 },
  dimLabelRow:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  dimLabel:   { fontSize: 13, fontWeight: "600", color: Colors.gray700 },
  slider:     { width: "100%", height: 40 },
  dimRangeRow:{ flexDirection: "row", justifyContent: "space-between", marginTop: -4 },
  dimRange:   { fontSize: 11, color: Colors.gray400 },
  areaText:   { marginTop: 4, fontSize: 12, color: Colors.gray500, textAlign: "right" },
  priceRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  priceLabel: { fontSize: 14, color: Colors.gray500 },
  priceValue: { fontSize: 14, color: Colors.gray900 },
  priceGreen: { color: Colors.green },
  priceTotalRow: { flexDirection: "row", justifyContent: "space-between",
                   borderTopWidth: 1, borderTopColor: Colors.gray200,
                   paddingTop: 10, marginTop: 4, marginBottom: 4 },
  priceTotalLabel:{ fontSize: 15, fontWeight: "700", color: Colors.gray900 },
  priceTotalValue:{ fontSize: 20, fontWeight: "800", color: Colors.orange },
  priceDisclaimer:{ fontSize: 11, color: Colors.gray400, marginBottom: 12 },
  manualText: { fontSize: 14, color: Colors.gray500, marginBottom: 16, lineHeight: 21 },
  ctaBtn:     { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 14,
                alignItems: "center", marginTop: 4 },
  ctaBtnText: { color: Colors.white, fontWeight: "700", fontSize: 16 },
  saveBtn:    { borderWidth: 1, borderColor: Colors.orange, borderRadius: 10, paddingVertical: 13,
                alignItems: "center", marginTop: 8 },
  saveBtnText:{ color: Colors.orange, fontWeight: "600", fontSize: 15 },
  modalOverlay:{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
  modalCard:  { backgroundColor: Colors.white, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.gray900, marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: 10, padding: 12,
                fontSize: 15, color: Colors.gray900, marginBottom: 14 },

  sectionLabel:   { fontSize: 12, fontWeight: "600", color: Colors.gray500, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  doorWidthRow:   { flexDirection: "row", gap: 8 },
  doorWidthBtn:   { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1,
                    borderColor: Colors.gray200, alignItems: "center", backgroundColor: Colors.white },
  doorWidthBtnActive: { borderColor: Colors.orange, backgroundColor: Colors.orangeLight },
  doorWidthLabel: { fontSize: 14, fontWeight: "600", color: Colors.gray500 },
  doorWidthLabelActive: { color: Colors.orange },

  colorRow:       { flexDirection: "row", gap: 8 },
  colorBtn:       { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1,
                    borderColor: Colors.gray200, alignItems: "center", backgroundColor: Colors.white, gap: 6 },
  colorBtnActive: { borderColor: Colors.orange, backgroundColor: Colors.orangeLight },
  colorSwatch:    { width: 22, height: 22, borderRadius: 11 },
  colorLabel:     { fontSize: 12, fontWeight: "600", color: Colors.gray500 },
  colorLabelActive: { color: Colors.orange },

  wallRow:        { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  wallLabel:      { fontSize: 13, fontWeight: "600", color: Colors.gray700, marginBottom: 8 },
  elemRow:        { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  elemBtn:        { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1,
                    borderColor: Colors.gray200, backgroundColor: Colors.white },
  elemBtnActive:  { borderColor: Colors.orange, backgroundColor: Colors.orangeLight },
  elemLabel:      { fontSize: 12, fontWeight: "600", color: Colors.gray500 },
  elemLabelActive:{ color: Colors.orange },

  grunnBtn:       { backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.gray200 },
  grunnBtnInner:  { flexDirection: "row", alignItems: "center", padding: 16 },
  grunnBtnTitle:  { fontSize: 15, fontWeight: "700", color: Colors.gray900 },
  grunnBtnSub:    { fontSize: 12, color: Colors.gray500, marginTop: 2 },
});
