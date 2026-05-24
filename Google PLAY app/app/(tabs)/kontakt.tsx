import {
  View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

interface ContactRow {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
}

function ContactItem({ icon, label, value, onPress }: ContactRow) {
  const Inner = (
    <View style={styles.contactRow}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={Colors.orange} />
      </View>
      <View style={styles.contactText}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={[styles.contactValue, onPress && styles.contactValueLink]}>{value}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={Colors.gray400} />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {Inner}
      </TouchableOpacity>
    );
  }
  return Inner;
}

const TEAM = [
  {
    name: "Christian",
    role: "Daglig leder",
    phone: "+47 476 17 563",
    phoneRaw: "+4747617563",
    initials: "C",
    color: "#1d4ed8",
  },
  {
    name: "Ola",
    role: "Prosjektleder",
    phone: "+47 913 44 486",
    phoneRaw: "+4791344486",
    initials: "O",
    color: Colors.orange,
  },
];

export default function KontaktScreen() {
  function email()   { Linking.openURL("mailto:post@garasjeproffen.no"); }
  function website() { Linking.openURL("https://garasjeproffen.no"); }
  function maps() {
    const addr = encodeURIComponent("Tjødnavegen 8b, 4344 Bryne");
    const url = Platform.OS === "ios"
      ? `maps:?q=${addr}`
      : `https://maps.google.com/?q=${addr}`;
    Linking.openURL(url);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>GarasjeProffen</Text>
        <Text style={styles.heroSub}>Din garasjeleverandør på Jæren</Text>
      </View>

      {/* Team */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ta kontakt</Text>
        {TEAM.map((m, i) => (
          <TouchableOpacity
            key={m.name}
            style={[styles.teamRow, i < TEAM.length - 1 && styles.teamBorder]}
            onPress={() => Linking.openURL(`tel:${m.phoneRaw}`)}
            activeOpacity={0.7}
          >
            <View style={[styles.teamAvatar, { backgroundColor: m.color }]}>
              <Text style={styles.teamInitials}>{m.initials}</Text>
            </View>
            <View style={styles.teamInfo}>
              <Text style={styles.teamName}>{m.name}</Text>
              <Text style={styles.teamRole}>{m.role}</Text>
              <Text style={styles.teamPhone}>{m.phone}</Text>
            </View>
            <View style={styles.callBtn}>
              <Ionicons name="call" size={18} color={Colors.orange} />
            </View>
          </TouchableOpacity>
        ))}
        <View style={styles.divider} />
        <ContactItem
          icon="mail-outline"
          label="E-post"
          value="post@garasjeproffen.no"
          onPress={email}
        />
      </View>

      {/* Besøksadresse */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Besøksadresse</Text>
        <ContactItem
          icon="location-outline"
          label="Adresse"
          value={"Tjødnavegen 8b\n4344 Bryne"}
          onPress={maps}
        />
      </View>

      {/* Åpningstider */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Åpningstider</Text>
        {[
          ["Mandag – fredag", "07:00 – 16:00"],
          ["Lørdag", "Etter avtale"],
          ["Søndag", "Stengt"],
        ].map(([day, time]) => (
          <View key={day} style={styles.timeRow}>
            <Text style={styles.timeDay}>{day}</Text>
            <Text style={styles.timeValue}>{time}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.webBtn} onPress={website}>
        <Ionicons name="globe-outline" size={18} color={Colors.white} style={{ marginRight: 8 }} />
        <Text style={styles.webBtnText}>Besøk garasjeproffen.no</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content:   { padding: 16, paddingBottom: 48, gap: 12 },
  hero:      { backgroundColor: Colors.orange, borderRadius: 12, padding: 20, alignItems: "center" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: Colors.white },
  heroSub:   { fontSize: 14, color: "#ffedd5", marginTop: 4 },
  card:      { backgroundColor: Colors.white, borderRadius: 12, padding: 16,
               borderWidth: 1, borderColor: Colors.gray200 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: Colors.gray500, marginBottom: 12,
               textTransform: "uppercase", letterSpacing: 0.5 },

  teamRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  teamBorder:   { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  teamAvatar:   { width: 48, height: 48, borderRadius: 24, justifyContent: "center",
                  alignItems: "center", marginRight: 12 },
  teamInitials: { fontSize: 20, fontWeight: "800", color: Colors.white },
  teamInfo:     { flex: 1 },
  teamName:     { fontSize: 16, fontWeight: "700", color: Colors.gray900 },
  teamRole:     { fontSize: 12, color: Colors.gray500, marginTop: 1 },
  teamPhone:    { fontSize: 14, color: Colors.orange, fontWeight: "600", marginTop: 2 },
  callBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.orangeLight,
                  justifyContent: "center", alignItems: "center" },

  contactRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  iconWrap:        { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.orangeLight,
                     justifyContent: "center", alignItems: "center", marginRight: 12 },
  contactText:     { flex: 1 },
  contactLabel:    { fontSize: 12, color: Colors.gray500 },
  contactValue:    { fontSize: 15, color: Colors.gray900, fontWeight: "600", marginTop: 1 },
  contactValueLink:{ color: Colors.orange },
  divider:         { height: 1, backgroundColor: Colors.gray100, marginVertical: 8 },
  timeRow:         { flexDirection: "row", justifyContent: "space-between",
                     paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  timeDay:         { fontSize: 14, color: Colors.gray700 },
  timeValue:       { fontSize: 14, color: Colors.gray900, fontWeight: "600" },
  webBtn:          { backgroundColor: Colors.gray900, borderRadius: 10, paddingVertical: 14,
                     flexDirection: "row", justifyContent: "center", alignItems: "center" },
  webBtnText:      { color: Colors.white, fontWeight: "700", fontSize: 15 },
});
