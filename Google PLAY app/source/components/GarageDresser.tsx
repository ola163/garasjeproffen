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
  const webRef    = useRef<WebView>(null);
  const readyRef  = useRef(false);
  const pendingRef = useRef<Props | null>(null);

  // Stable initial URL — never changes so WebView never reloads
  const initialUrl = useRef(
    `${DRESSER_URL}?widthMm=${widthMm}&lengthMm=${lengthMm}&roofType=${roofType}&buildingType=${buildingType}`
  );

  function send(p: Props) {
    webRef.current?.injectJavaScript(`
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'update',
          widthMm: ${p.widthMm},
          lengthMm: ${p.lengthMm},
          roofType: '${p.roofType}',
          buildingType: '${p.buildingType}',
        })
      }));
      true;
    `);
  }

  useEffect(() => {
    if (readyRef.current) {
      send({ widthMm, lengthMm, roofType, buildingType });
    } else {
      pendingRef.current = { widthMm, lengthMm, roofType, buildingType };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthMm, lengthMm, roofType, buildingType]);

  function onLoad() {
    readyRef.current = true;
    const p = pendingRef.current ?? { widthMm, lengthMm, roofType, buildingType };
    pendingRef.current = null;
    setTimeout(() => send(p), 300);
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        source={{ uri: initialUrl.current }}
        style={styles.web}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.orange} size="large" />
          </View>
        )}
        startInLoadingState
        onLoad={onLoad}
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
