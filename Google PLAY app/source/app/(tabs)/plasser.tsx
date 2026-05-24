import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/Colors";
import GarageDresser from "@/components/GarageDresser";
import type { RoofType, BuildingType, PackageType } from "@/lib/pricing";

const WIDTH_STEPS  = [2600, 3200, 3800, 4400, 5000, 5600, 6200, 6800, 7400, 8000];
const LENGTH_STEPS = [2400, 3000, 3600, 4200, 4800, 5400, 6000, 6600, 7200, 7800, 8400];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function PlasserScreen() {
  const [widthMm,      setWidthMm]      = useState(5000);
  const [lengthMm,     setLengthMm]     = useState(6000);
  const [roofType,     setRoofType]     = useState<RoofType>("saltak");
  const [buildingType, setBuildingType] = useState<BuildingType>("garasje");
  const [panelOpen,    setPanelOpen]    = useState(false);

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
          <Text style={styles.panelTitle}>Bygningstype</Text>
          <View style={styles.row}>
            {(["garasje", "carport"] as BuildingType[]).map((bt) => (
              <Chip key={bt} label={bt === "garasje" ? "Garasje" : "Carport"} active={buildingType === bt} onPress={() => setBuildingType(bt)} />
            ))}
          </View>

          <Text style={styles.panelTitle}>Taktype</Text>
          <View style={styles.row}>
            {(["saltak", "flattak"] as RoofType[]).map((rt) => (
              <Chip key={rt} label={rt === "saltak" ? "Saltak" : "Flattak"} active={roofType === rt} onPress={() => setRoofType(rt)} />
            ))}
          </View>

          <Text style={styles.panelTitle}>Bredde</Text>
          <View style={[styles.row, styles.wrap]}>
            {WIDTH_STEPS.map((w) => (
              <Chip key={w} label={`${(w / 1000).toFixed(1)} m`} active={widthMm === w} onPress={() => setWidthMm(w)} />
            ))}
          </View>

          <Text style={styles.panelTitle}>Lengde</Text>
          <View style={[styles.row, styles.wrap]}>
            {LENGTH_STEPS.map((l) => (
              <Chip key={l} label={`${(l / 1000).toFixed(1)} m`} active={lengthMm === l} onPress={() => setLengthMm(l)} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  toggleBtn:     {
    position: "absolute", bottom: 16, alignSelf: "center",
    backgroundColor: Colors.orange, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }, android: { elevation: 6 } }),
  },
  toggleText:    { color: Colors.white, fontWeight: "700", fontSize: 14 },
  panel:         {
    position: "absolute", bottom: 60, left: 0, right: 0,
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, paddingBottom: 8,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.12, shadowRadius: 8 }, android: { elevation: 8 } }),
  },
  panelTitle:    { fontSize: 12, fontWeight: "700", color: Colors.gray500, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },
  row:           { flexDirection: "row", gap: 6 },
  wrap:          { flexWrap: "wrap" },
  chip:          { borderWidth: 1, borderColor: Colors.gray200, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.white },
  chipActive:    { backgroundColor: Colors.orange, borderColor: Colors.orange },
  chipText:      { fontSize: 13, color: Colors.gray700, fontWeight: "500" },
  chipTextActive:{ color: Colors.white, fontWeight: "700" },
});
