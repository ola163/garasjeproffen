"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Switch, Image,
  StyleSheet, Platform, Pressable, useWindowDimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import type { WebView as WebViewType } from "react-native-webview";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import { calculatePrice, formatPrice } from "@/lib/pricing";
import type { PackageType, RoofType, BuildingType } from "@/lib/pricing";

const BASE_URL = "https://garasjeproffen.no";

const WIDTH_MIN  = 2400;
const WIDTH_MAX  = 8000;
const LENGTH_MIN = 2400;
const LENGTH_MAX = 8400;

const DOOR_WIDTH_OPTIONS = [
  { label: "2 500 mm — inkl. motor og montering", value: 2500 },
  { label: "3 000 mm — inkl. motor og montering", value: 3000 },
  { label: "5 000 mm (dobbel) — inkl. motor og montering", value: 5000 },
];

const ELEMENT_PRICES: Record<string, number> = {
  door: 5995, window1: 2995, window2: 3095, window3: 5895,
};
const ELEMENT_LABELS: Record<string, string> = {
  door: "Dør 90×210", window1: "Vindu 100×50", window2: "Vindu 100×60", window3: "Vindu 100×100",
};
const WALL_LABELS: Record<string, string> = {
  front: "Front", back: "Bak", left: "Venstre", right: "Høyre",
};

function snapWidth(v: number)  { return Math.max(2600, Math.min(8000, Math.round((v - 200) / 600) * 600 + 200)); }
function snapLength(v: number) { return Math.max(2400, Math.min(8400, Math.round(v / 600) * 600)); }
function isWidthSnapped(v: number)  { return (v - 200) % 600 === 0; }
function isLengthSnapped(v: number) { return v % 600 === 0; }

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
          <Text style={[styles.segmentLabel, value === opt && styles.segmentLabelActive]} numberOfLines={1}>
            {labels?.[opt] ?? opt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function DimSlider({
  label, valueMm, minMm, maxMm, step, snapped, onChange,
}: {
  label: string; valueMm: number; minMm: number; maxMm: number;
  step: number; snapped: boolean; onChange: (v: number) => void;
}) {
  return (
    <View style={styles.dimRow}>
      <View style={styles.dimLabelRow}>
        <Text style={styles.dimLabel}>{label}</Text>
        <View style={[styles.dimBadge, snapped && styles.dimBadgeGreen]}>
          <Text style={[styles.dimBadgeText, snapped && styles.dimBadgeTextGreen]}>
            {(valueMm / 1000).toFixed(1)} m {snapped ? "✓" : ""}
          </Text>
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
    </View>
  );
}

type AddedElement = { side: "front" | "back" | "left" | "right"; category: string };

function SituasjonsplanView({
  widthMm, lengthMm, buildingType,
}: { widthMm: number; lengthMm: number; buildingType: BuildingType }) {
  const { width: screenWidth } = useWindowDimensions();
  const PAD = 40;
  const planW = screenWidth;
  const planH = screenWidth * 0.75;
  const scale = Math.min((planW - PAD * 2) / widthMm, (planH - PAD * 2) / lengthMm);
  const gW = widthMm * scale;
  const gL = lengthMm * scale;
  const offsetX = (planW - gW) / 2;
  const offsetY = (planH - gL) / 2;

  const wLabel = `${(widthMm / 1000).toFixed(1)} m`;
  const lLabel = `${(lengthMm / 1000).toFixed(1)} m`;

  return (
    <View style={{ width: planW, height: planH, backgroundColor: "#e8f5e9", justifyContent: "center", alignItems: "center" }}>
      {/* North indicator */}
      <View style={{ position: "absolute", top: 8, right: 12, alignItems: "center" }}>
        <Text style={{ fontSize: 10, color: "#555", fontWeight: "700" }}>N</Text>
        <Text style={{ fontSize: 14, color: "#555" }}>↑</Text>
      </View>

      {/* Garage rectangle */}
      <View
        style={{
          position: "absolute",
          left: offsetX,
          top: offsetY,
          width: gW,
          height: gL,
          backgroundColor: buildingType === "carport" ? "rgba(180,180,220,0.5)" : "rgba(200,200,210,0.85)",
          borderWidth: 2,
          borderColor: "#555",
        }}
      >
        {/* Label inside */}
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: "#333", fontWeight: "700" }}>
            {buildingType === "carport" ? "Carport" : "Garasje"}
          </Text>
          <Text style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
            {wLabel} × {lLabel}
          </Text>
        </View>

        {/* Width label (bottom) */}
        <Text style={{
          position: "absolute", bottom: -20, left: 0, right: 0,
          textAlign: "center", fontSize: 10, color: "#333", fontWeight: "600",
        }}>
          ← {wLabel} →
        </Text>
      </View>

      {/* Length label (right side) */}
      <View style={{
        position: "absolute",
        left: offsetX + gW + 6,
        top: offsetY + gL / 2 - 10,
      }}>
        <Text style={{ fontSize: 10, color: "#333", fontWeight: "600" }}>↕{"\n"}{lLabel}</Text>
      </View>

      {/* Scale legend */}
      <Text style={{ position: "absolute", bottom: 6, left: 12, fontSize: 9, color: "#888" }}>
        Situasjonsplan — ikke skalert til eksakt tomt
      </Text>
    </View>
  );
}

export default function KonfiguratorScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscape = screenWidth > screenHeight;

  const [buildingType, setBuildingType] = useState<BuildingType>("garasje");
  const [packageType,  setPackageType]  = useState<PackageType>("materialpakke");
  const [roofType,     setRoofType]     = useState<RoofType>("flattak");
  const [widthMm,      setWidthMm]      = useState(5000);
  const [lengthMm,     setLengthMm]     = useState(6000);
  const [snapOnly,     setSnapOnly]     = useState(false);
  const [viewerReady,  setViewerReady]  = useState(false);
  const [doorWidthMm,  setDoorWidthMm]  = useState(2500);
  const [doorColor,    setDoorColor]    = useState<"hvit" | "sort">("hvit");
  const [portOpen,     setPortOpen]     = useState(false);
  const [vinduOpen,    setVinduOpen]    = useState(false);
  const [grunnarbeid,  setGrunnarbeid]  = useState(false);
  const [addedElements, setAddedElements] = useState<AddedElement[]>([]);
  const [viewMode,     setViewMode]     = useState<"3d" | "plan">("3d");

  const webViewRef = useRef<WebViewType>(null);

  const doorHeight = 2125;
  const effectiveDoorWidth = buildingType === "carport" ? 0 : doorWidthMm;

  const embedUrl = `${BASE_URL}/embed?width=${widthMm}&length=${lengthMm}&roofType=${roofType}&doorWidth=${effectiveDoorWidth}&doorHeight=${doorHeight}&buildingType=${buildingType}&doorColor=${doorColor}`;

  const updateViewer = useCallback(() => {
    if (!viewerReady || !webViewRef.current) return;
    const js = `window.__updateGarage?.({ widthMm: ${widthMm}, lengthMm: ${lengthMm}, roofType: '${roofType}', doorWidthMm: ${effectiveDoorWidth}, doorHeightMm: ${doorHeight}, buildingType: '${buildingType}', doorColor: '${doorColor}' }); true;`;
    webViewRef.current.injectJavaScript(js);
  }, [viewerReady, widthMm, lengthMm, roofType, effectiveDoorWidth, doorHeight, buildingType, doorColor]);

  useEffect(() => { updateViewer(); }, [updateViewer]);

  const widthStep  = snapOnly ? 600 : 200;
  const widthMin   = snapOnly ? 2600 : WIDTH_MIN;
  const lengthStep = 600;

  function handleSnapToggle(val: boolean) {
    if (val) { setWidthMm(snapWidth(widthMm)); setLengthMm(snapLength(lengthMm)); }
    setSnapOnly(val);
  }

  function addElement(side: AddedElement["side"], category: string) {
    const exists = addedElements.some(e => e.side === side && e.category === category);
    if (!exists) setAddedElements(prev => [...prev, { side, category }]);
  }
  function removeElement(i: number) {
    setAddedElements(prev => prev.filter((_, j) => j !== i));
  }

  const elementTotal = addedElements.reduce((sum, el) => sum + (ELEMENT_PRICES[el.category] ?? 0), 0);

  const pricing = useMemo(
    () => calculatePrice(lengthMm, widthMm, packageType, roofType, buildingType),
    [lengthMm, widthMm, packageType, roofType, buildingType],
  );

  const totalWithElements = pricing.totalPrice + elementTotal;

  const wSnapped = buildingType === "garasje" && isWidthSnapped(widthMm);
  const lSnapped = buildingType === "garasje" && isLengthSnapped(lengthMm);
  const sqm = (widthMm / 1000) * (lengthMm / 1000);

  const snappedCount = (wSnapped ? 1 : 0) + (lSnapped ? 1 : 0);
  const discountPct = snappedCount === 2 ? 10 : snappedCount === 1 ? 5 : 0;

  const SIDEBAR_W = isLandscape ? Math.round(Math.min(260, screenWidth * 0.28)) : undefined;

  // Viewer takes ~78% of height in portrait, full minus sidebar in landscape
  const viewerH = isLandscape ? undefined : Math.round(screenHeight * 0.78);

  return (
    <View style={[styles.root, isLandscape ? styles.rootRow : styles.rootCol]}>
      {/* Viewer area */}
      <View style={isLandscape ? styles.viewerLandscape : [styles.viewerPortrait, { height: viewerH }]}>

        {viewMode === "3d" ? (
          <WebView
            ref={webViewRef}
            source={{ uri: embedUrl }}
            style={StyleSheet.absoluteFill}
            javaScriptEnabled
            scrollEnabled={false}
            bounces={false}
            onLoad={() => setViewerReady(true)}
            originWhitelist={["*"]}
          />
        ) : (
          <SituasjonsplanView widthMm={widthMm} lengthMm={lengthMm} buildingType={buildingType} />
        )}

        {/* Logo overlay */}
        <View style={styles.logoOverlay} pointerEvents="none">
          <Image
            source={require("../../assets/logo.jpg")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* View mode toggle */}
        <View style={styles.viewToggle}>
          {(["3d", "plan"] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.viewToggleBtn, viewMode === mode && styles.viewToggleBtnActive]}
              onPress={() => setViewMode(mode)}
              activeOpacity={0.8}
            >
              <Text style={[styles.viewToggleText, viewMode === mode && styles.viewToggleTextActive]}>
                {mode === "3d" ? "3D" : "Situasjonsplan"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Sidebar / Controls */}
      <ScrollView
        style={[styles.sidebar, isLandscape && { width: SIDEBAR_W }]}
        contentContainerStyle={styles.sidebarContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Type */}
        <Text style={styles.sectionLabel}>Type bygg</Text>
        <SegmentControl
          options={["garasje", "carport"] as BuildingType[]}
          value={buildingType}
          onChange={setBuildingType}
          labels={{ garasje: "Garasje", carport: "Carport" }}
        />

        {/* Tjeneste */}
        <Text style={[styles.sectionLabel, { marginTop: 10 }]}>Tjeneste</Text>
        <SegmentControl
          options={["materialpakke", "prefab"] as PackageType[]}
          value={packageType}
          onChange={setPackageType}
          labels={{ materialpakke: "Materialpakke", prefab: "Prefab" }}
        />

        {/* Taktype */}
        {buildingType === "garasje" && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 10 }]}>Taktype</Text>
            <SegmentControl
              options={["flattak", "saltak"] as RoofType[]}
              value={roofType}
              onChange={setRoofType}
              labels={{ flattak: "Flatt tak", saltak: "Saltak" }}
            />
          </>
        )}

        {/* Standardmål + discount info */}
        {buildingType === "garasje" && (
          <>
            <View style={styles.snapRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.snapLabel}>Standardmål</Text>
                <Text style={styles.snapHint}>5% rabatt på 1 mål · 10% på begge</Text>
              </View>
              <Switch
                value={snapOnly}
                onValueChange={handleSnapToggle}
                trackColor={{ false: Colors.gray200, true: Colors.green }}
                thumbColor={Colors.white}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
            {discountPct > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  ✓ {discountPct}% standardmål-rabatt er inkludert
                </Text>
              </View>
            )}
          </>
        )}

        {/* Sliders */}
        <View style={{ marginTop: 6 }}>
          <DimSlider
            label="Bredde"
            valueMm={widthMm}
            minMm={widthMin}
            maxMm={WIDTH_MAX}
            step={widthStep}
            snapped={wSnapped}
            onChange={(v) => setWidthMm(snapOnly ? snapWidth(v) : v)}
          />
          <DimSlider
            label="Lengde"
            valueMm={lengthMm}
            minMm={LENGTH_MIN}
            maxMm={LENGTH_MAX}
            step={lengthStep}
            snapped={lSnapped}
            onChange={(v) => setLengthMm(snapOnly ? snapLength(v) : v)}
          />
        </View>

        <Text style={styles.areaText}>
          {sqm.toFixed(1)} m²
          {sqm > 50 && <Text style={styles.areaWarning}> · Over 50 m² — søknadspliktig</Text>}
        </Text>

        {/* ── Garasjeport ── */}
        {buildingType !== "carport" && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setPortOpen(o => !o)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Garasjeport</Text>
              <Text style={styles.chevron}>{portOpen ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {portOpen && (
              <View style={styles.sectionBody}>
                <Text style={styles.subLabel}>Bredde på port</Text>
                {DOOR_WIDTH_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.optionRow, doorWidthMm === opt.value && styles.optionRowActive]}
                    onPress={() => setDoorWidthMm(opt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.radioCircle, doorWidthMm === opt.value && styles.radioCircleActive]} />
                    <Text style={[styles.optionLabel, doorWidthMm === opt.value && styles.optionLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                <Text style={[styles.subLabel, { marginTop: 10 }]}>Farge</Text>
                <View style={styles.colorRow}>
                  {(["hvit", "sort"] as const).map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorBtn, doorColor === c && styles.colorBtnActive]}
                      onPress={() => setDoorColor(c)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.colorDot, c === "sort" && { backgroundColor: "#111" }]} />
                      <Text style={[styles.colorLabel, doorColor === c && { color: Colors.orange, fontWeight: "700" }]}>
                        {c === "hvit" ? "Hvit" : "Sort"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Hörmann badge */}
                <View style={styles.hormannBox}>
                  <View style={styles.hormannBadge}>
                    <Text style={styles.hormannText}>HÖRMANN</Text>
                  </View>
                  <Text style={styles.hormannModel}>RenoMatic – isolert seksjonport</Text>
                  {["10 års garanti", "CO₂-nøytral produksjon", "Fingerklemmebeskyttelse", "5 årsgaranti på portåpner*", "Inkl. motor og montering"].map(f => (
                    <Text key={f} style={styles.hormannFeature}>✓ {f}</Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Dør og vindu ── */}
        {buildingType !== "carport" && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setVinduOpen(o => !o)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Dør og vindu</Text>
              {addedElements.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{addedElements.length}</Text>
                </View>
              )}
              <Text style={styles.chevron}>{vinduOpen ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {vinduOpen && (
              <View style={styles.sectionBody}>
                <Text style={styles.subLabel}>Legg til på vegg</Text>
                <View style={styles.wallGrid}>
                  {(["back", "left", "right"] as const).map(side => (
                    <View key={side} style={styles.wallCol}>
                      <Text style={styles.wallName}>{WALL_LABELS[side]}</Text>
                      {["door", "window1", "window2"].map(cat => (
                        <TouchableOpacity
                          key={cat}
                          style={styles.addBtn}
                          onPress={() => addElement(side, cat)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.addBtnText}>+ {ELEMENT_LABELS[cat].split(" ")[0]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
                {addedElements.length > 0 && (
                  <View style={{ marginTop: 10, gap: 4 }}>
                    {addedElements.map((el, i) => (
                      <View key={i} style={styles.elRow}>
                        <Text style={styles.elLabel}>
                          {ELEMENT_LABELS[el.category]} · {WALL_LABELS[el.side]}
                        </Text>
                        <TouchableOpacity onPress={() => removeElement(i)} style={styles.elRemove}>
                          <Text style={styles.elRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Grunnarbeid ── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.grunnBtn, grunnarbeid && styles.grunnBtnActive]}
            onPress={() => setGrunnarbeid(o => !o)}
            activeOpacity={0.7}
          >
            <Text style={[styles.grunnBtnText, grunnarbeid && styles.grunnBtnTextActive]}>
              {grunnarbeid ? "✓ Grunnarbeid inkludert" : "+ Legg til grunn- og betongarbeid"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.grunnNote}>Endelig pris etter befaring</Text>
        </View>

        {/* Price */}
        <View style={styles.priceBox}>
          {pricing.manualQuote ? (
            <Text style={styles.manualText}>Manuelt tilbud</Text>
          ) : (
            <>
              <Text style={styles.priceTotal}>{formatPrice(totalWithElements)}</Text>
              {pricing.adjustments.map((adj) => (
                <Text key={adj.label} style={[styles.priceAdj, adj.amount < 0 && { color: Colors.green }]}>
                  {adj.label}: {formatPrice(adj.amount)}
                </Text>
              ))}
              {elementTotal > 0 && (
                <Text style={styles.priceAdj}>Tilleggsutstyr: {formatPrice(elementTotal)}</Text>
              )}
              {grunnarbeid && (
                <Text style={styles.priceAdj}>Grunnarbeid: Avklares på befaring</Text>
              )}
            </>
          )}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() =>
            router.push({
              pathname: "/tilbud",
              params: {
                buildingType, packageType, roofType,
                widthMm: String(widthMm), lengthMm: String(lengthMm),
                totalPrice: String(totalWithElements),
                manualQuote: pricing.manualQuote ? "1" : "0",
              },
            })
          }
        >
          <Text style={styles.ctaBtnText}>Be om tilbud</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.gray50 },
  rootRow:     { flexDirection: "row" },
  rootCol:     { flexDirection: "column" },

  viewerPortrait:  { overflow: "hidden" },
  viewerLandscape: { flex: 1, overflow: "hidden" },

  logoOverlay: { position: "absolute", top: 10, left: 10, zIndex: 10 },
  logo:        { width: 90, height: 32, borderRadius: 6, opacity: 0.92 },

  viewToggle: {
    position: "absolute", bottom: 10, right: 10, zIndex: 10,
    flexDirection: "row", gap: 4,
  },
  viewToggleBtn: {
    backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  viewToggleBtnActive: { backgroundColor: Colors.orange },
  viewToggleText: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  viewToggleTextActive: { color: Colors.white },

  sidebar:        { backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.gray200 },
  sidebarContent: { padding: 10, paddingBottom: 32, gap: 0 },

  sectionLabel: { fontSize: 9, fontWeight: "600", color: Colors.gray500, marginBottom: 4,
                  textTransform: "uppercase", letterSpacing: 0.5 },
  segment:      { flexDirection: "row", backgroundColor: Colors.gray100, borderRadius: 7, padding: 2, gap: 2 },
  segmentBtn:   { flex: 1, paddingVertical: 6, borderRadius: 5, alignItems: "center" },
  segmentBtnActive: { backgroundColor: Colors.white, ...Platform.select({
    ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
    android: { elevation: 1 },
  }) },
  segmentLabel:       { fontSize: 11, color: Colors.gray500, fontWeight: "500" },
  segmentLabelActive: { color: Colors.gray900, fontWeight: "700" },

  snapRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  snapLabel: { fontSize: 12, color: Colors.gray700, fontWeight: "600" },
  snapHint:  { fontSize: 10, color: Colors.gray400, marginTop: 1 },

  discountBadge: {
    backgroundColor: "#f0fdf4", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    marginTop: 4, borderWidth: 1, borderColor: "#bbf7d0",
  },
  discountText: { fontSize: 11, color: Colors.green, fontWeight: "600" },

  dimRow:      { marginTop: 6 },
  dimLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 1 },
  dimLabel:    { fontSize: 11, fontWeight: "600", color: Colors.gray700 },
  dimBadge:    { backgroundColor: Colors.orangeLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  dimBadgeGreen:     { backgroundColor: "#f0fdf4" },
  dimBadgeText:      { fontSize: 11, fontWeight: "700", color: Colors.orange },
  dimBadgeTextGreen: { color: Colors.green },
  slider:    { width: "100%", height: 28 },

  areaText:    { fontSize: 10, color: Colors.gray400, textAlign: "right", marginTop: 0 },
  areaWarning: { color: "#b45309" },

  section:       { marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.gray100, paddingTop: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle:  { fontSize: 12, fontWeight: "700", color: Colors.gray800, flex: 1 },
  sectionBody:   { marginTop: 8 },
  chevron:       { fontSize: 10, color: Colors.gray400, marginLeft: 4 },
  badge:         { backgroundColor: Colors.orange, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, marginRight: 6 },
  badgeText:     { fontSize: 10, color: Colors.white, fontWeight: "700" },

  subLabel:      { fontSize: 10, fontWeight: "600", color: Colors.gray500, marginBottom: 5,
                   textTransform: "uppercase", letterSpacing: 0.4 },
  optionRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 7,
                   borderWidth: 1, borderColor: Colors.gray200, borderRadius: 8,
                   paddingHorizontal: 10, marginBottom: 5, backgroundColor: Colors.white },
  optionRowActive: { borderColor: Colors.orange, backgroundColor: Colors.orangeLight },
  radioCircle:   { width: 13, height: 13, borderRadius: 7, borderWidth: 2,
                   borderColor: Colors.gray300, marginRight: 8, flexShrink: 0 },
  radioCircleActive: { borderColor: Colors.orange, backgroundColor: Colors.orange },
  optionLabel:   { fontSize: 12, color: Colors.gray700, flex: 1 },
  optionLabelActive: { color: Colors.orange, fontWeight: "600" },

  colorRow:    { flexDirection: "row", gap: 8 },
  colorBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                 gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
                 borderColor: Colors.gray200, backgroundColor: Colors.white },
  colorBtnActive: { borderColor: Colors.orange, backgroundColor: Colors.orangeLight },
  colorDot:    { width: 13, height: 13, borderRadius: 7, backgroundColor: "#fff",
                 borderWidth: 1, borderColor: Colors.gray300 },
  colorLabel:  { fontSize: 12, color: Colors.gray700 },

  hormannBox:     { marginTop: 10, backgroundColor: Colors.gray50, borderRadius: 8,
                    padding: 8, borderWidth: 1, borderColor: Colors.gray200 },
  hormannBadge:   { backgroundColor: "#1d4ed8", borderRadius: 4, paddingHorizontal: 6,
                    paddingVertical: 2, alignSelf: "flex-start", marginBottom: 5 },
  hormannText:    { color: Colors.white, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  hormannModel:   { fontSize: 10, fontWeight: "600", color: Colors.gray700, marginBottom: 3 },
  hormannFeature: { fontSize: 10, color: Colors.gray500, lineHeight: 15 },

  wallGrid: { flexDirection: "row", gap: 5 },
  wallCol:  { flex: 1 },
  wallName: { fontSize: 9, fontWeight: "700", color: Colors.gray500, marginBottom: 4,
              textTransform: "uppercase", letterSpacing: 0.4 },
  addBtn:   { backgroundColor: Colors.gray100, borderRadius: 6, paddingVertical: 5,
              alignItems: "center", marginBottom: 3 },
  addBtnText: { fontSize: 9, color: Colors.gray700, fontWeight: "600" },

  elRow:       { flexDirection: "row", alignItems: "center", backgroundColor: Colors.gray100,
                 borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  elLabel:     { flex: 1, fontSize: 10, color: Colors.gray700 },
  elRemove:    { padding: 4 },
  elRemoveText:{ fontSize: 16, color: Colors.gray400, lineHeight: 18 },

  grunnBtn:     { borderWidth: 2, borderStyle: "dashed", borderColor: Colors.orange,
                  borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  grunnBtnActive: { backgroundColor: "#f0fdf4", borderColor: Colors.green, borderStyle: "solid" },
  grunnBtnText: { fontSize: 11, fontWeight: "700", color: Colors.orange },
  grunnBtnTextActive: { color: Colors.green },
  grunnNote:    { fontSize: 9, color: Colors.gray400, textAlign: "center", marginTop: 3 },

  priceBox:    { marginTop: 10, backgroundColor: Colors.gray50, borderRadius: 10,
                 padding: 10, borderWidth: 1, borderColor: Colors.gray200 },
  priceTotal:  { fontSize: 17, fontWeight: "800", color: Colors.orange, marginBottom: 3 },
  priceAdj:    { fontSize: 10, color: Colors.gray500, lineHeight: 14 },
  manualText:  { fontSize: 12, color: Colors.gray500, fontStyle: "italic" },

  ctaBtn:     { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 12,
                alignItems: "center", marginTop: 10 },
  ctaBtnText: { color: Colors.white, fontWeight: "700", fontSize: 14 },
});
