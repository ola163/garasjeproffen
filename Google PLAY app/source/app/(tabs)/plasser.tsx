import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Switch, TouchableOpacity } from "react-native";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import GarageDresser from "@/components/GarageDresser";
import { useAuth } from "@/context/AuthContext";
import { useConfig } from "@/context/ConfigContext";
import type { RoofType, BuildingType } from "@/lib/pricing";

const WIDTH_STEPS  = [2600, 3200, 3800, 4400, 5000, 5600, 6200, 6800, 7400, 8000];
const LENGTH_STEPS = [2400, 3000, 3600, 4200, 4800, 5400, 6000, 6600, 7200, 7800, 8400];

function snapWidth(v: number)  { return Math.max(2600, Math.min(8000, Math.round((v - 200) / 600) * 600 + 200)); }
function snapLength(v: number) { return Math.max(2400, Math.min(8400, Math.round(v / 600) * 600)); }

export default function PlasserScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { config } = useConfig();

  const [widthMm,      setWidthMm]      = useState(config.widthMm);
  const [lengthMm,     setLengthMm]     = useState(config.lengthMm);
  const [roofType,     setRoofType]     = useState<RoofType>(config.roofType);
  const [buildingType, setBuildingType] = useState<BuildingType>(config.buildingType);
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [useSliders,   setUseSliders]   = useState(true);

  if (!user) {
    return (
      <View style={styles.authGate}>
        <Ionicons name="map-outline" size={64} color={Colors.gray400} />
        <Text style={styles.authTitle}>Logg inn for å plassere</Text>
        <Text style={styles.authSub}>
          Du må være innlogget for å plassere garasjen på kart
        </Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/login")}>
          <Text style={styles.loginBtnText}>Logg inn / Opprett konto</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Map fills everything */}
      <GarageDresser
        widthMm={widthMm}
        lengthMm={lengthMm}
        roofType={roofType}
        buildingType={buildingType}
      />

      {/* Floating toggle button */}
      <Pressable style={styles.toggleBtn} onPress={() => setPanelOpen((v) => !v)}>
        <Text style={styles.toggleText}>{panelOpen ? "Skjul mål ▲" : "Endre mål ▼"}</Text>
      </Pressable>

      {/* Slide-up panel */}
      {panelOpen && (
        <View style={styles.panel}>
          {/* Bygningstype */}
          <Text style={styles.panelTitle}>Bygningstype</Text>
          <View style={styles.chipRow}>
            {(["garasje", "carport"] as BuildingType[]).map((bt) => (
              <Pressable
                key={bt}
                style={[styles.chip, buildingType === bt && styles.chipActive]}
                onPress={() => setBuildingType(bt)}
              >
                <Text style={[styles.chipText, buildingType === bt && styles.chipTextActive]}>
                  {bt === "garasje" ? "Garasje" : "Carport"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Taktype */}
          <Text style={styles.panelTitle}>Taktype</Text>
          <View style={styles.chipRow}>
            {(["saltak", "flattak"] as RoofType[]).map((rt) => (
              <Pressable
                key={rt}
                style={[styles.chip, roofType === rt && styles.chipActive]}
                onPress={() => setRoofType(rt)}
              >
                <Text style={[styles.chipText, roofType === rt && styles.chipTextActive]}>
                  {rt === "saltak" ? "Saltak" : "Flattak"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Mål med slider-toggle */}
          <View style={styles.sliderToggleRow}>
            <Text style={styles.panelTitle}>Mål</Text>
            <View style={styles.sliderToggleRight}>
              <Text style={styles.sliderToggleLabel}>Sliders</Text>
              <Switch
                value={useSliders}
                onValueChange={setUseSliders}
                trackColor={{ false: Colors.gray200, true: Colors.green }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          {useSliders ? (
            <>
              <Text style={styles.dimLabel}>
                Bredde: <Text style={styles.dimValue}>{(widthMm / 1000).toFixed(1)} m</Text>
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={2600}
                maximumValue={8000}
                step={600}
                value={snapWidth(widthMm)}
                onValueChange={(v) => setWidthMm(snapWidth(v))}
                minimumTrackTintColor={Colors.orange}
                maximumTrackTintColor={Colors.gray200}
                thumbTintColor={Colors.orange}
              />
              <Text style={styles.dimLabel}>
                Lengde: <Text style={styles.dimValue}>{(lengthMm / 1000).toFixed(1)} m</Text>
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={2400}
                maximumValue={8400}
                step={600}
                value={snapLength(lengthMm)}
                onValueChange={(v) => setLengthMm(snapLength(v))}
                minimumTrackTintColor={Colors.orange}
                maximumTrackTintColor={Colors.gray200}
                thumbTintColor={Colors.orange}
              />
            </>
          ) : (
            <>
              <Text style={styles.panelSubTitle}>Bredde</Text>
              <View style={[styles.chipRow, styles.wrap]}>
                {WIDTH_STEPS.map((w) => (
                  <Pressable
                    key={w}
                    style={[styles.chip, widthMm === w && styles.chipActive]}
                    onPress={() => setWidthMm(w)}
                  >
                    <Text style={[styles.chipText, widthMm === w && styles.chipTextActive]}>
                      {(w / 1000).toFixed(1)} m
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.panelSubTitle}>Lengde</Text>
              <View style={[styles.chipRow, styles.wrap]}>
                {LENGTH_STEPS.map((l) => (
                  <Pressable
                    key={l}
                    style={[styles.chip, lengthMm === l && styles.chipActive]}
                    onPress={() => setLengthMm(l)}
                  >
                    <Text style={[styles.chipText, lengthMm === l && styles.chipTextActive]}>
                      {(l / 1000).toFixed(1)} m
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },

  authGate: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: Colors.gray50 },
  authTitle:{ fontSize: 20, fontWeight: "700", color: Colors.gray900, marginTop: 16, textAlign: "center" },
  authSub:  { fontSize: 14, color: Colors.gray500, textAlign: "center", marginTop: 8, marginBottom: 24, lineHeight: 20 },
  loginBtn: { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32 },
  loginBtnText: { color: Colors.white, fontWeight: "700", fontSize: 16 },

  toggleBtn: {
    position: "absolute", bottom: 16, alignSelf: "center",
    backgroundColor: Colors.orange, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
      android: { elevation: 6 },
    }),
  },
  toggleText: { color: Colors.white, fontWeight: "700", fontSize: 14 },

  panel: {
    position: "absolute", bottom: 60, left: 0, right: 0,
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, paddingBottom: 8,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  panelTitle:     { fontSize: 12, fontWeight: "700", color: Colors.gray500, textTransform: "uppercase",
                    letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },
  panelSubTitle:  { fontSize: 11, fontWeight: "600", color: Colors.gray400, textTransform: "uppercase",
                    letterSpacing: 0.4, marginTop: 8, marginBottom: 4 },
  sliderToggleRow:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  sliderToggleRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  sliderToggleLabel: { fontSize: 12, color: Colors.gray600, fontWeight: "500" },
  dimLabel:       { fontSize: 13, fontWeight: "600", color: Colors.gray700, marginTop: 4 },
  dimValue:       { color: Colors.orange },
  slider:         { width: "100%", height: 36, marginBottom: 4 },
  chipRow:        { flexDirection: "row", gap: 6 },
  wrap:           { flexWrap: "wrap" },
  chip:           { borderWidth: 1, borderColor: Colors.gray200, borderRadius: 20, paddingHorizontal: 12,
                    paddingVertical: 6, backgroundColor: Colors.white },
  chipActive:     { backgroundColor: Colors.orange, borderColor: Colors.orange },
  chipText:       { fontSize: 13, color: Colors.gray700, fontWeight: "500" },
  chipTextActive: { color: Colors.white, fontWeight: "700" },
});
