import { useRef, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type WebViewType from "react-native-webview";

const VIEWER_URL = "https://www.garasjeproffen.no/viewer";

interface Props {
  widthMm: number;
  lengthMm: number;
  roofType: "saltak" | "flattak";
  buildingType: "garasje" | "carport";
}

export default function GarageViewer3D({ widthMm, lengthMm, roofType, buildingType }: Props) {
  const webViewRef = useRef<WebViewType>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<Props | null>(null);

  function send(props: Props) {
    const script = `
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'update',
          widthMm: ${props.widthMm},
          lengthMm: ${props.lengthMm},
          roofType: '${props.roofType}',
          buildingType: '${props.buildingType}'
        })
      }));
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }

  // Push updates whenever props change (after page is ready)
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
    const initial = pendingRef.current ?? { widthMm, lengthMm, roofType, buildingType };
    pendingRef.current = null;
    // Small delay so the Three.js canvas is ready
    setTimeout(() => send(initial), 500);
  }

  const initialUrl = useRef(`${VIEWER_URL}?widthMm=${widthMm}&lengthMm=${lengthMm}&roofType=${roofType}&buildingType=${buildingType}`);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: initialUrl.current }}
        style={styles.webview}
        onLoad={onLoad}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        originWhitelist={["https://*"]}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 260, borderRadius: 12, overflow: "hidden", backgroundColor: "#1e293b" },
  webview:   { flex: 1 },
});
