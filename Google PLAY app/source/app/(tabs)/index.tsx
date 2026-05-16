"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Switch,
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
  label, valueMm, minMm, maxMm, step, snapped,
  onChange,
}: {
  label: string; valueMm: number; minMm: number; maxMm: number; step: number;
  snapped: boolean; onChange: (v: number) => void;
}) {
  const displayM = (valueMm / 1000).toFixed(1);
  return (
    <View style={styles.dimRow}>
      <View style={styles.dimLabelRow}>
        <Text style={styles.dimLabel}>{label}</Text>
        <View style={[styles.dimBadge, snapped && styles.dimBadgeGreen]}>
          <Text style={[styles.dimBadgeText, snapped && styles.dimBadgeTextGreen]}>{displayM} m</Text>
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

export default function KonfiguratorScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const SIDEBAR_W = Math.round(Math.min(170, screenWidth * 0.42));

  const [buildingType, setBuildingType] = useState<BuildingType>("garasje");
  const [packageType,  setPackageType]  = useState<PackageType>("materialpakke");
  const [roofType,     setRoofType]     = useState<RoofType>("flattak");
  const [widthMm,      setWidthMm]      = useState(5000);
  const [lengthMm,     setLengthMm]     = useState(6000);
  const [snapOnly,     setSnapOnly]     = useState(false);
  const [viewerReady,  setViewerReady]  = useState(false);

  const webViewRef = useRef<WebViewType>(null);

  const doorWidth  = buildingType === "carport" ? 0 : 2500;
  const doorHeight = 2125;

  const embedUrl = `${BASE_URL}/embed?width=${widthMm}&length=${lengthMm}&roofType=${roofType}&doorWidth=${doorWidth}&doorHeight=${doorHeight}&buildingType=${buildingType}`;

  const updateViewer = useCallback(() => {
    if (!viewerReady || !webViewRef.current) return;
    const js = `window.__updateGarage?.({ widthMm: ${widthMm}, lengthMm: ${lengthMm}, roofType: '${roofType}', doorWidthMm: ${doorWidth}, doorHeightMm: ${doorHeight}, buildingType: '${buildingType}' }); true;`;
    webViewRef.current.injectJavaScript(js);
  }, [viewerReady, widthMm, lengthMm, roofType, doorWidth, doorHeight, buildingType]);

  useEffect(() => { updateViewer(); }, [updateViewer]);

  const widthStep  = snapOnly ? 600 : 200;
  const widthMin   = snapOnly ? 2600 : WIDTH_MIN;
  const lengthStep = 600;

  function handleSnapToggle(val: boolean) {
    if (val) { setWidthMm(snapWidth(widthMm)); setLengthMm(snapLength(lengthMm)); }
    setSnapOnly(val);
  }

  const pricing = useMemo(
    () => calculatePrice(lengthMm, widthMm, packageType, roofType, buildingType),
    [lengthMm, widthMm, packageType, roofType, buildingType],
  );

  const wSnapped = buildingType === "garasje" && isWidthSnapped(widthMm);
  const lSnapped = buildingType === "garasje" && isLengthSnapped(lengthMm);

  return (
    <View style={styles.root}>
      {/* 3D Viewer */}
      <View style={styles.viewer}>
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
      </View>

      {/* Right sidebar */}
      <ScrollView
        style={[styles.sidebar, { width: SIDEBAR_W }]}
        contentContainerStyle={styles.sidebarContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bygningstype */}
        <Text style={styles.sectionLabel}>Type</Text>
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
          labels={{ materialpakke: "Pakke", prefab: "Prefab" }}
        />

        {/* Taktype */}
        {buildingType === "garasje" && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 10 }]}>Tak</Text>
            <SegmentControl
              options={["flattak", "saltak"] as RoofType[]}
              value={roofType}
              onChange={setRoofType}
              labels={{ flattak: "Flatt", saltak: "Sal" }}
            />
          </>
        )}

        {/* Standardmål */}
        {buildingType === "garasje" && (
          <View style={styles.snapRow}>
            <Text style={styles.snapLabel}>Std. mål</Text>
            <Switch
              value={snapOnly}
              onValueChange={handleSnapToggle}
              trackColor={{ false: Colors.gray200, true: Colors.green }}
              thumbColor={Colors.white}
              style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
            />
          </View>
        )}

        {/* Sliders */}
        <View style={{ marginTop: 8 }}>
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

        {/* Areal */}
        <Text style={styles.areaText}>
          {((widthMm / 1000) * (lengthMm / 1000)).toFixed(1)} m²
        </Text>

        {/* Prisestimat */}
        <View style={styles.priceBox}>
          {pricing.manualQuote ? (
            <Text style={styles.manualText}>Manuelt tilbud</Text>
          ) : (
            <>
              <Text style={styles.priceTotal}>{formatPrice(pricing.totalPrice)}</Text>
              {pricing.adjustments.map((adj) => (
                <Text key={adj.label} style={[styles.priceAdj, adj.amount < 0 && { color: Colors.green }]}>
                  {adj.label}: {formatPrice(adj.amount)}
                </Text>
              ))}
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
                totalPrice: String(pricing.totalPrice),
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
  root:        { flex: 1, flexDirection: "row", backgroundColor: Colors.gray50 },
  viewer:      { flex: 1 },
  sidebar:     { backgroundColor: Colors.white, borderLeftWidth: 1, borderLeftColor: Colors.gray200 },
  sidebarContent: { padding: 10, paddingBottom: 32, gap: 0 },
  sectionLabel:{ fontSize: 10, fontWeight: "600", color: Colors.gray500, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  segment:     { flexDirection: "row", backgroundColor: Colors.gray100, borderRadius: 7, padding: 2, gap: 2 },
  segmentBtn:  { flex: 1, paddingVertical: 6, borderRadius: 5, alignItems: "center" },
  segmentBtnActive: { backgroundColor: Colors.white, ...Platform.select({
    ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
    android: { elevation: 1 },
  }) },
  segmentLabel:       { fontSize: 11, color: Colors.gray500, fontWeight: "500" },
  segmentLabelActive: { color: Colors.gray900, fontWeight: "700" },
  snapRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  snapLabel:   { fontSize: 11, color: Colors.gray700, fontWeight: "500" },
  dimRow:      { marginTop: 8 },
  dimLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  dimLabel:    { fontSize: 11, fontWeight: "600", color: Colors.gray700 },
  dimBadge:    { backgroundColor: Colors.orangeLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  dimBadgeGreen: { backgroundColor: "#f0fdf4" },
  dimBadgeText: { fontSize: 11, fontWeight: "700", color: Colors.orange },
  dimBadgeTextGreen: { color: Colors.green },
  slider:      { width: "100%", height: 32, marginHorizontal: -8 },
  areaText:    { fontSize: 10, color: Colors.gray400, textAlign: "right", marginTop: 2 },
  priceBox:    { marginTop: 10, backgroundColor: Colors.gray50, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: Colors.gray200 },
  priceTotal:  { fontSize: 16, fontWeight: "800", color: Colors.orange, marginBottom: 4 },
  priceAdj:    { fontSize: 9, color: Colors.gray500, lineHeight: 14 },
  manualText:  { fontSize: 11, color: Colors.gray500, fontStyle: "italic" },
  ctaBtn:      { backgroundColor: Colors.orange, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 10 },
  ctaBtnText:  { color: Colors.white, fontWeight: "700", fontSize: 13 },
});
