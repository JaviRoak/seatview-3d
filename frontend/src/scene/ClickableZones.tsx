import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three';
import { consumeDragFlag, type PovTarget } from './CameraController';
import type { Zone } from '../api/types';
import { beeleSector, BEELE_CLOSED } from './beeleLayout';

/** Same sector boundaries used when configuring Cuscatlán's ticket inventory. */
export function cuscatlanSector(x: number, z: number, row: number) {
  if (x > 0 && Math.abs(z) < Math.abs(x) * 1.5) return 0;
  if (Math.abs(z) >= Math.abs(x) * 1.5) return z > 0 ? 1 : 2;
  if (row <= 22) return 6;
  return row <= 31 ? (z < 0 ? 3 : 4) : (z < 0 ? 7 : 5);
}

const openings = [
  [19,7,13],[19,18,24],[19,29,35],[67,7,13],[67,18,24],[67,29,35],
  [28,18,24],[28,29,35],[76,18,24],[76,29,35],
  [3,18,24],[92,18,24],[44,18,24],[51,18,24],[35,0,6],
];
function edge(angle: number, offset: number, height: number): [number,number,number] {
  const c=Math.cos(angle),s=Math.sin(angle);
  return [(46+offset)*Math.sign(c)*Math.abs(c)**(2/2.8),height,-(68+offset)*Math.sign(s)*Math.abs(s)**(2/2.8)];
}

/** Pick surfaces follow the model's actual steps, excluding tunnels and circulation. */
export function buildZoneSurfaces(concert=false) {
  const positions: number[][] = Array.from({length:concert?10:8},()=>[]);
  for(let r=0;r<40;r++) {
    if(r===22||r===23)continue;
    const d=r*.78+(r>=22?1.7:0),y=1.4+r*.46-.21+.025;
    for(let i=0;i<96;i++) {
      if(openings.some(([segment,lo,hi])=>segment===i&&r>=lo&&r<hi))continue;
      const angle=2*Math.PI*(i+.5)/96;
      if(r>=36&&angle>=.55*Math.PI&&angle<=1.45*Math.PI)continue;
      const a=edge(2*Math.PI*i/96,d,y),b=edge(2*Math.PI*(i+1)/96,d,y);
      const c=edge(2*Math.PI*(i+1)/96,d+.78,y),e=edge(2*Math.PI*i/96,d+.78,y);
      const x=(a[0]+b[0]+c[0]+e[0])/4,z=(a[2]+b[2]+c[2]+e[2])/4;
      const sector=concert?beeleSector(x,z):cuscatlanSector(x,z,r+1);
      if(sector<0||(concert&&BEELE_CLOSED.includes(sector)))continue;
      positions[sector].push(...a,...b,...c,...a,...c,...e);
      // Riser makes the same region reachable at a shallow viewing angle.
      const lowA:[number,number,number]=[a[0],y-.46,a[2]],lowB:[number,number,number]=[b[0],y-.46,b[2]];
      positions[sector].push(...lowA,...lowB,...b,...lowA,...b,...a);
    }
  }
  return positions.map(p=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.computeBoundingSphere();return g;});
}

export function isZoneClick(distance:number,button:number) { return distance<=6&&button===0; }

export function ClickableZones({zones,selected,enabled,onSelect,onHover,concert=false}:{zones:Zone[];selected:number;enabled:boolean;onSelect:(zone:number,target:PovTarget)=>void;onHover:(zone:number|null)=>void;concert?:boolean}) {
  const geometry=useMemo(()=>buildZoneSurfaces(concert),[concert]),[hovered,setHovered]=useState<number|null>(null);
  const {gl}=useThree();
  // Track the full gesture, even if it starts on the pitch and finishes on a zone.
  const gesture=useRef({x:0,y:0,distance:0,button:0});
  useEffect(()=>{
    const canvas=gl.domElement;
    const down=(e:PointerEvent)=>{gesture.current={x:e.clientX,y:e.clientY,distance:0,button:e.button};};
    const move=(e:PointerEvent)=>{if(e.buttons)gesture.current.distance=Math.max(gesture.current.distance,Math.hypot(e.clientX-gesture.current.x,e.clientY-gesture.current.y));};
    canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);
    return()=>{canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.style.cursor='';};
  },[gl]);
  useEffect(()=>()=>geometry.forEach(g=>g.dispose()),[geometry]);
  useEffect(()=>{if(!enabled){setHovered(null);onHover(null);}},[enabled,onHover]);
  useEffect(()=>{gl.domElement.style.cursor=enabled&&hovered!==null?'pointer':'';return()=>{gl.domElement.style.cursor='';};},[enabled,hovered,gl]);
  const enter=(e:ThreeEvent<PointerEvent>,i:number)=>{e.stopPropagation();setHovered(i);onHover(i);};
  return <group visible={enabled}>
    {geometry.map((g,i)=>g.getAttribute('position').count===0?null:<mesh key={i} geometry={g}
      onPointerMove={e=>{if(enabled&&!(concert&&BEELE_CLOSED.includes(i)))enter(e,i);}}
      onPointerOut={()=>{setHovered(null);onHover(null);}}
      onClick={e=>{
        if(!enabled||(concert&&BEELE_CLOSED.includes(i)))return;
        e.stopPropagation();
        if(consumeDragFlag()||!isZoneClick(Math.max(e.delta,gesture.current.distance),gesture.current.button))return;
        // Keep the exact clicked location, lifting riser hits to the tread above.
        const p=g.getAttribute('position'),face=e.face;
        const height=face?Math.max(p.getY(face.a),p.getY(face.b),p.getY(face.c)):e.point.y;
        onSelect(i,{position:[e.point.x,height-.025,e.point.z],rotY:Math.atan2(-e.point.x,-e.point.z)});
      }}>
      <meshBasicMaterial color={hovered===i?'#b2ffff':zones[i]?.color??'#65cfe3'} transparent opacity={hovered===i?.42:selected===i?.22:concert?.14:0} depthWrite={false} side={DoubleSide} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
    </mesh>)}
  </group>;
}
