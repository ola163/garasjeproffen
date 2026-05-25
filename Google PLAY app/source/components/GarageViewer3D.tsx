import { useRef, useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import type WebViewType from "react-native-webview";

interface Props {
  widthMm: number;
  lengthMm: number;
  roofType: "saltak" | "flattak";
  buildingType: "garasje" | "carport";
  containerStyle?: ViewStyle;
}

// Three.js viewer that loads real GLB models from the website
const VIEWER_HTML = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a2535;overflow:hidden}
canvas{display:block}
#msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  color:#94a3b8;font-family:system-ui,sans-serif;font-size:13px;text-align:center;line-height:1.6;
  pointer-events:none}
</style>
</head><body>
<div id="msg">Laster 3D-modell...</div>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script>
var W=5,L=6,roof='saltak',btype='garasje';
var scene,camera,renderer,controls,model=null;
var currentKey=null,busy=false;
var BASE='https://garasjeproffen.no';
var URLS={saltak:BASE+'/Garasje_saltak1.glb',flattak:BASE+'/Garasje_Flatt_tak.glb',carport:BASE+'/Carport_GLB.glb'};

function modelKey(){return btype==='carport'?'carport':roof;}

function init(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x1a2535);
  scene.fog=new THREE.FogExp2(0x1a2535,0.025);

  var cw=window.innerWidth,ch=window.innerHeight;
  camera=new THREE.PerspectiveCamera(35,cw/ch,0.1,200);
  camera.position.set(9,6,9);

  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setSize(cw,ch);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.0;
  document.body.appendChild(renderer.domElement);

  controls=new THREE.OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=0.06;
  controls.minDistance=2;controls.maxDistance=60;
  controls.maxPolarAngle=Math.PI/2.02;
  controls.target.set(0,1.5,0);
  controls.update();

  /* Lights */
  scene.add(new THREE.AmbientLight(0xffffff,0.55));
  var sun=new THREE.DirectionalLight(0xfffde7,1.15);
  sun.position.set(10,16,8);sun.castShadow=true;
  sun.shadow.mapSize.width=sun.shadow.mapSize.height=2048;
  sun.shadow.camera.left=sun.shadow.camera.bottom=-20;
  sun.shadow.camera.right=sun.shadow.camera.top=20;
  sun.shadow.camera.near=0.5;sun.shadow.camera.far=80;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xc9e8ff,0x557755,0.45));

  /* Ground */
  var gMat=new THREE.MeshLambertMaterial({color:0x2e4d22});
  var gnd=new THREE.Mesh(new THREE.PlaneGeometry(120,120),gMat);
  gnd.rotation.x=-Math.PI/2;gnd.receiveShadow=true;scene.add(gnd);
  var grid=new THREE.GridHelper(50,50,0x4a7a3a,0x3d6b2e);
  grid.position.y=0.01;grid.material.opacity=0.35;grid.material.transparent=true;
  scene.add(grid);

  loadModel(modelKey());
  animate();

  window.addEventListener('resize',function(){
    var w=window.innerWidth,h=window.innerHeight;
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);
  });
  if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage('{"type":"ready"}');
}

function loadModel(key){
  if(key===currentKey&&model){scaleModel();return;}
  if(busy)return;
  busy=true;
  if(model){scene.remove(model);model=null;}
  setMsg('Laster modell...');
  var loader=new THREE.GLTFLoader();
  loader.load(URLS[key],
    function(gltf){
      busy=false;currentKey=key;model=gltf.scene;
      model.traverse(function(c){
        if(c.isMesh){
          c.castShadow=true;c.receiveShadow=true;
          if(c.material){
            if(Array.isArray(c.material))c.material.forEach(function(m){m.envMapIntensity=0.3;});
            else c.material.envMapIntensity=0.3;
          }
        }
      });
      scene.add(model);
      scaleModel();
      setMsg('');
    },
    undefined,
    function(e){busy=false;setMsg('Kunne ikke laste modell');console.warn(e);}
  );
}

function scaleModel(){
  if(!model)return;
  /* Compute original bounding box */
  model.scale.set(1,1,1);model.position.set(0,0,0);
  var box=new THREE.Box3().setFromObject(model);
  var size=new THREE.Vector3();box.getSize(size);
  /* Scale X=width, Z=length, Y unchanged */
  var sX=size.x>0.001?W/size.x:1;
  var sZ=size.z>0.001?L/size.z:1;
  model.scale.set(sX,1,sZ);
  /* Re-center */
  box.setFromObject(model);
  var min=new THREE.Vector3(),center=new THREE.Vector3();
  box.getMin(min);box.getCenter(center);
  model.position.set(-center.x,-min.y,-center.z);
  /* Adjust camera */
  var d=Math.max(W,L)*1.6+3;
  camera.position.set(d,d*0.65,d);
  controls.target.set(0,Math.max(W,L)*0.25,0);
  controls.update();
}

function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}

function setMsg(t){var el=document.getElementById('msg');if(el)el.textContent=t;}

function onMsg(data){
  try{
    var m=typeof data==='string'?JSON.parse(data):data;
    if(m&&m.type==='update'){
      var prevKey=modelKey();
      W=(m.widthMm||5000)/1000;L=(m.lengthMm||6000)/1000;
      roof=m.roofType||roof;btype=m.buildingType||btype;
      var newKey=modelKey();
      if(newKey!==prevKey)loadModel(newKey);else scaleModel();
    }
  }catch(e){}
}
window.addEventListener('message',function(e){onMsg(e.data);});
document.addEventListener('message',function(e){onMsg(e.data);});
window.onload=init;
</script></body></html>`;

export default function GarageViewer3D({ widthMm, lengthMm, roofType, buildingType, containerStyle }: Props) {
  const webViewRef = useRef<WebViewType>(null);
  const readyRef   = useRef(false);
  const pendingRef = useRef<Omit<Props, "containerStyle"> | null>(null);

  function send(props: Omit<Props, "containerStyle">) {
    const payload = JSON.stringify({
      type: "update",
      widthMm: props.widthMm, lengthMm: props.lengthMm,
      roofType: props.roofType, buildingType: props.buildingType,
    });
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(payload)}}));true;`
    );
  }

  useEffect(() => {
    const props = { widthMm, lengthMm, roofType, buildingType };
    if (readyRef.current) send(props);
    else pendingRef.current = props;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthMm, lengthMm, roofType, buildingType]);

  function onMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "ready") {
        readyRef.current = true;
        const pending = pendingRef.current ?? { widthMm, lengthMm, roofType, buildingType };
        pendingRef.current = null;
        setTimeout(() => send(pending), 100);
      }
    } catch {}
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <WebView
        ref={webViewRef}
        source={{ html: VIEWER_HTML }}
        style={styles.webview}
        onMessage={onMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowFileAccess
        allowUniversalAccessFromFileURLs
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 340, borderRadius: 12, overflow: "hidden", backgroundColor: "#1a2535" },
  webview:   { flex: 1 },
});
