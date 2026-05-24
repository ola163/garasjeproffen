import { useRef, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import WebView from "react-native-webview";
import { Colors } from "@/constants/Colors";

const DRESSER_URL = "https://www.garasjeproffen.no/dresser";

interface Props {
  widthMm:      number;
  lengthMm:     number;
  roofType:     "saltak" | "flattak";
  buildingType: "garasje" | "carport";
}

export default function GarageDresser({ widthMm, lengthMm, roofType, buildingType }: Props) {
  const webRef = useRef<WebView>(null);

  const url = `${DRESSER_URL}?widthMm=${widthMm}&lengthMm=${lengthMm}&roofType=${roofType}&buildingType=${buildingType}`;

  useEffect(() => {
    webRef.current?.injectJavaScript(`
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'update',
          widthMm: ${widthMm},
          lengthMm: ${lengthMm},
          roofType: '${roofType}',
          buildingType: '${buildingType}',
        })
      }));
      true;
    `);
  }, [widthMm, lengthMm, roofType, buildingType]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        source={{ uri: url }}
        style={styles.web}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.orange} size="large" />
          </View>
        )}
        startInLoadingState
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  web:       { flex: 1 },
  loader:    { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center",
               backgroundColor: Colors.gray50 } as any,
});
