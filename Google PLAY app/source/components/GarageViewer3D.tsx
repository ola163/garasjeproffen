import { useRef, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type WebViewType from "react-native-webview";

interface Props {
  widthMm: number;
  lengthMm: number;
  roofType: "saltak" | "flattak";
  buildingType: "garasje" | "carport";
}

// Standalone Three.js 3D model — no server dependency
const VIEWER_HTML = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>*{margin:0;padding:0}body{background:#1e293b;overflow:hidden}canvas{display:block}</style>
</head><body>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
var W=5,L=6,roof='saltak',btype='garasje';
var scene,camera,renderer,garage,angle=0;

function init(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x1e293b);
  var cw=window.innerWidth,ch=window.innerHeight;
  camera=new THREE.PerspectiveCamera(42,cw/ch,0.1,200);
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setSize(cw,ch);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff,0.55));
  var sun=new THREE.DirectionalLight(0xfffde7,1.1);
  sun.position.set(10,15,8);sun.castShadow=true;
  sun.shadow.mapSize.width=sun.shadow.mapSize.height=1024;
  sun.shadow.camera.left=sun.shadow.camera.bottom=-20;
  sun.shadow.camera.right=sun.shadow.camera.top=20;
  sun.shadow.camera.near=0.5;sun.shadow.camera.far=80;
  scene.add(sun);
  var fill=new THREE.DirectionalLight(0x8faac8,0.35);fill.position.set(-6,8,-6);scene.add(fill);

  var gnd=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshLambertMaterial({color:0x253344}));
  gnd.rotation.x=-Math.PI/2;gnd.receiveShadow=true;scene.add(gnd);
  var grid=new THREE.GridHelper(40,40,0x2d4259,0x263848);grid.position.y=0.005;scene.add(grid);

  build();animate();
  window.addEventListener('resize',function(){
    var w=window.innerWidth,h=window.innerHeight;
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);
  });
  if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage('{"type":"ready"}');
}

function build(){
  if(garage)scene.remove(garage);
  garage=new THREE.Group();
  var wm=new THREE.MeshLambertMaterial({color:0xe8ecf0});
  var rm=new THREE.MeshLambertMaterial({color:0x475569,side:THREE.DoubleSide});
  var dm=new THREE.MeshLambertMaterial({color:0x2d3748});
  var pm=new THREE.MeshLambertMaterial({color:0x7a96b0});
  var wallH=2.4,ov=0.25;

  if(btype==='garasje'){
    var bx=new THREE.Mesh(new THREE.BoxGeometry(W,wallH,L),wm);
    bx.position.y=wallH/2;bx.castShadow=true;bx.receiveShadow=true;garage.add(bx);

    var dW=Math.min(W*0.70,2.9),dH=wallH*0.88;
    var dr=new THREE.Mesh(new THREE.BoxGeometry(dW,dH,0.06),dm);
    dr.position.set(0,dH/2,-L/2+0.04);garage.add(dr);
    for(var i=1;i<4;i++){
      var py=dH/4*i;
      var lg=new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-dW/2+0.05,py,-L/2+0.12),
        new THREE.Vector3(dW/2-0.05,py,-L/2+0.12)]);
      garage.add(new THREE.Line(lg,new THREE.LineBasicMaterial({color:0x1a2233})));
    }

    if(roof==='saltak'){
      var rH=Math.min(W*0.27,1.35),hw=W/2;
      var sl=Math.sqrt(hw*hw+rH*rH)+ov,sa=Math.atan2(rH,hw),rl=L+ov*2;
      var rg=new THREE.BoxGeometry(sl,0.09,rl);
      var rL=new THREE.Mesh(rg,rm);rL.position.set(-hw/2,wallH+rH/2,0);rL.rotation.z=sa;rL.castShadow=true;garage.add(rL);
      var rR=new THREE.Mesh(rg.clone(),rm);rR.position.set(hw/2,wallH+rH/2,0);rR.rotation.z=-sa;rR.castShadow=true;garage.add(rR);
      var shp=new THREE.Shape();shp.moveTo(-hw,0);shp.lineTo(hw,0);shp.lineTo(0,rH);shp.closePath();
      var sg=new THREE.ShapeGeometry(shp);
      var gF=new THREE.Mesh(sg,wm);gF.position.set(0,wallH,L/2+0.01);garage.add(gF);
      var gB=new THREE.Mesh(sg.clone(),wm);gB.rotation.y=Math.PI;gB.position.set(0,wallH,-L/2-0.01);garage.add(gB);
      var rdg=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,rl),rm);rdg.position.set(0,wallH+rH+0.04,0);garage.add(rdg);
    } else {
      var flt=new THREE.Mesh(new THREE.BoxGeometry(W+ov*2,0.12,L+ov*2),rm);
      flt.position.y=wallH+0.06;flt.castShadow=true;garage.add(flt);
    }
  } else {
    var cpH=2.5,pg=new THREE.BoxGeometry(0.12,cpH,0.12);
    [[-W/2+0.1,-L/2+0.1],[-W/2+0.1,L/2-0.1],[W/2-0.1,-L/2+0.1],[W/2-0.1,L/2-0.1]].forEach(function(p){
      var pst=new THREE.Mesh(pg.clone(),pm);pst.position.set(p[0],cpH/2,p[1]);pst.castShadow=true;garage.add(pst);
    });
    var bg=new THREE.BoxGeometry(0.1,0.12,L+0.2);
    [-W/2+0.1,W/2-0.1].forEach(function(x){
      var bm=new THREE.Mesh(bg.clone(),pm);bm.position.set(x,cpH-0.06,0);garage.add(bm);
    });
    var cr=new THREE.Mesh(new THREE.BoxGeometry(W+ov*2,0.1,L+ov*2),rm);
    cr.position.y=cpH+0.05;cr.castShadow=true;garage.add(cr);
  }
  scene.add(garage);
}

function animate(){
  requestAnimationFrame(animate);
  angle+=0.004;
  var r=Math.max(W,L)*1.3+4;
  camera.position.x=Math.cos(angle)*r;
  camera.position.z=Math.sin(angle)*r;
  camera.position.y=Math.max(W,L)*0.65+2;
  camera.lookAt(0,1.5,0);
  renderer.render(scene,camera);
}

function onMsg(data){
  try{
    var m=typeof data==='string'?JSON.parse(data):data;
    if(m&&m.type==='update'){
      W=(m.widthMm||5000)/1000;L=(m.lengthMm||6000)/1000;
      roof=m.roofType||roof;btype=m.buildingType||btype;
      build();
    }
  }catch(e){}
}
window.addEventListener('message',function(e){onMsg(e.data);});
document.addEventListener('message',function(e){onMsg(e.data);});
window.onload=init;
</script></body></html>`;

export default function GarageViewer3D({ widthMm, lengthMm, roofType, buildingType }: Props) {
  const webViewRef = useRef<WebViewType>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<Props | null>(null);

  function send(props: Props) {
    const payload = JSON.stringify({
      type: "update",
      widthMm: props.widthMm,
      lengthMm: props.lengthMm,
      roofType: props.roofType,
      buildingType: props.buildingType,
    });
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(payload)}}));true;`
    );
  }

  useEffect(() => {
    if (readyRef.current) send({ widthMm, lengthMm, roofType, buildingType });
    else pendingRef.current = { widthMm, lengthMm, roofType, buildingType };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthMm, lengthMm, roofType, buildingType]);

  function onMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "ready") {
        readyRef.current = true;
        const pending = pendingRef.current ?? { widthMm, lengthMm, roofType, buildingType };
        pendingRef.current = null;
        setTimeout(() => send(pending), 150);
      }
    } catch {}
  }

  return (
    <View style={styles.container}>
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 260, borderRadius: 12, overflow: "hidden", backgroundColor: "#1e293b" },
  webview:   { flex: 1 },
});
