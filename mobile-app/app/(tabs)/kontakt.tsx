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

export default function KontaktScreen() {
  function call(number: string) { Linking.openURL(`tel:${number}`); }
  function email()    { Linking.openURL("mailto:post@garasjeproffen.no"); }
  function maps()     {
    const addr = encodeURIComponent("Gangstøvegen 9, 4344 Bryne");
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

      {/* Kontakt */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ta kontakt</Text>
        <ContactItem
          icon="call-outline"
          label="Christian"
          value="+47 476 17 563"
          onPress={() => call("+4747617563")}
        />
        <View style={styles.divider} />
        <ContactItem
          icon="call-outline"
          label="Ola"
          value="+47 913 44 486"
          onPress={() => call("+4791344486")}
        />
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
          value={"Gangstøvegen 9\n4344 Bryne"}
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
  contactRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  iconWrap:        { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.orangeLight,
                     justifyContent: "center", alignItems: "center", marginRight: 12 },
  contactText:     { flex: 1 },
  contactLabel:    { fontSize: 12, color: Colors.gray500 },
  contactValue:    { fontSize: 15, color: Colors.gray900, fontWeight: "600", marginTop: 1 },
  contactValueLink:{ color: Colors.orange },
  divider:         { height: 1, backgroundColor: Colors.gray100, marginVertical: 2 },
  timeRow:         { flexDirection: "row", justifyContent: "space-between",
                     paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  timeDay:         { fontSize: 14, color: Colors.gray700 },
  timeValue:       { fontSize: 14, color: Colors.gray900, fontWeight: "600" },
});
