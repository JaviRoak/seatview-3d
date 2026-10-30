import {useEffect,useMemo,useRef} from 'react';
import {Html} from '@react-three/drei';
import {BoxGeometry,Color,InstancedMesh,Matrix4} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {consumeDragFlag,type PovTarget} from './CameraController';
import {isZoneClick} from './ClickableZones';
import {BEELE_ZONES} from './beeleLayout';

export type ConcertTable={x:number;z:number;zone:number};
function Tables({tables}:{tables:ConcertTable[]}){
  const ref=useRef<InstancedMesh>(null);
  const geometry=useMemo(()=>{
    const top=new BoxGeometry(1.55,.09,.85);top.translate(0,.96,0);
    const leg=new BoxGeometry(.18,.72,.18);leg.translate(0,.56,0);
    const g=mergeGeometries([top,leg])!;top.dispose();leg.dispose();return g;
  },[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useEffect(()=>{if(!ref.current)return;const m=new Matrix4();tables.forEach((t,i)=>{
    ref.current!.setMatrixAt(i,m.makeTranslation(t.x,0,t.z));ref.current!.setColorAt(i,new Color(t.zone<0?'#505666':BEELE_ZONES[t.zone].color));
  });ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();},[tables]);
  return <instancedMesh ref={ref} args={[geometry,undefined,tables.length]} raycast={()=>null}><meshLambertMaterial/></instancedMesh>;
}
function Box({position,size,color}:{position:[number,number,number];size:[number,number,number];color:string}){
  return <mesh position={position} raycast={()=>null}><boxGeometry args={size}/><meshLambertMaterial color={color}/></mesh>;
}
function Label({position,children,muted=false}:{position:[number,number,number];children:React.ReactNode;muted?:boolean}){
  return <Html center position={position} style={{pointerEvents:'none'}} zIndexRange={[8,0]}><span style={{display:'block',whiteSpace:'nowrap',padding:'4px 7px',borderRadius:5,background:muted?'#303744e6':'#0c1426ed',border:'1px solid #b9dbea66',color:muted?'#bac2cd':'#fff',fontSize:10,fontWeight:700,letterSpacing:'.04em'}}>{children}</span></Html>;
}

/** The concert changes only the event configuration; the football model is untouched. */
export function ConcertProduction({tables,overview,onVisit}:{tables:ConcertTable[];overview:boolean;onVisit:(zone:number,target:PovTarget)=>void}){
  const blocks=[{zone:0,x:16.4,z:0,w:28.7,d:108},{zone:1,x:-9.7,z:0,w:21,d:108},{zone:2,x:-28,z:0,w:14,d:108}];
  return <group>
    <Box position={[0,.08,0]} size={[90,.25,133]} color="#a6a8ad"/>
    {blocks.map(b=><mesh key={b.zone} position={[b.x,.23,b.z]} rotation={[-Math.PI/2,0,0]}
      onClick={e=>{e.stopPropagation();if(!overview||consumeDragFlag()||!isZoneClick(e.delta,e.button))return;
        if(b.zone===0&&e.point.x>20&&Math.abs(e.point.z)<27)return;
        if(b.zone===1&&e.point.x>-12&&Math.abs(e.point.z)<5)return;
        onVisit(b.zone,{position:[e.point.x,.25,e.point.z],rotY:Math.PI/2});}}>
      <planeGeometry args={[b.w,b.d]}/><meshLambertMaterial color={BEELE_ZONES[b.zone].color}/>
    </mesh>)}
    <Box position={[25.6,.26,1]} size={[10,.08,53]} color="#5c616b"/>
    <Tables tables={tables}/>
    <Box position={[39,1.5,0]} size={[11,2.8,33]} color="#151c28"/>
    <Box position={[43.6,8,0]} size={[.7,11,30]} color="#080c16"/>
    <Box position={[43.15,8,0]} size={[.12,8.5,25]} color="#8882c6"/>
    <Box position={[39,14,0]} size={[13,.6,37]} color="#273348"/>
    {[-18,18].map(z=><group key={z}>
      <Box position={[35,7,z]} size={[.5,14,.5]} color="#bac6cf"/>
      <Box position={[43,7,z]} size={[.5,14,.5]} color="#bac6cf"/>
      <Box position={[35,7,z*1.33]} size={[.5,9,10]} color="#a4d5e8"/>
      <Box position={[33,4,z]} size={[2.2,6,2.2]} color="#111621"/>
    </group>)}
    <Box position={[-5.4,1.5,0]} size={[9,2.6,8]} color="#2e3747"/>
    <Box position={[-5.4,3,0]} size={[10,.25,9]} color="#535f70"/>
    {overview&&<>
      <Label position={[39,16,0]}>BEÉLE · ESCENARIO</Label>
      <Label position={[21,2,-40]}>ULTRA PLATINUM</Label>
      <Label position={[21,2,40]}>ULTRA PLATINUM</Label>
      <Label position={[26,2,0]} muted>PALCO COSMO · NO A LA VENTA</Label>
      <Label position={[-6,4,0]}>FOH</Label>
      <Label position={[-8,2,-34]}>PLATINUM</Label>
      <Label position={[-8,2,34]}>PLATINUM</Label>
      <Label position={[-29,2,0]}>VIP · BLOQUES A–F</Label>
      <Label position={[-59,10,-38]}>TRIBUNA NORTE</Label>
      <Label position={[-63,10,0]}>PLATEA</Label>
      <Label position={[-59,10,38]}>TRIBUNA SUR</Label>
    </>}
  </group>;
}
