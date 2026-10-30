import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import {Text} from '@react-three/drei';
import type {Zone} from '../api/types';
import type {CrowdPoint} from './Crowd';
import type {PovTarget} from './CameraController';
import {BOCELLI_BLOCKS} from './bocelliLayout';

/** Tread-sized pick surfaces use actual chair samples, leaving every aisle open. */
export function bocelliZoneSurfaces(points:CrowdPoint[]){
  const vertices:number[][]=[[],[],[]];
  for(const [x,y,z,,zone] of points){
    if(zone<12||zone>14)continue;
    const a=vertices[zone-12],h=y+.4,w=.5,d=.4;
    a.push(x-w,h,z-d,x+w,h,z+d,x+w,h,z-d,x-w,h,z-d,x-w,h,z+d,x+w,h,z+d);
  }
  return vertices.map(a=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.computeVertexNormals();return g;});
}

export function BocelliProduction({points,zones,selected,overview,onVisit,onHover}:{
  points:CrowdPoint[];zones:Zone[];selected:number;overview:boolean;
  onVisit:(zone:number,target:PovTarget)=>void;onHover:(zone:number|null)=>void;
}){
  const surfaces=useMemo(()=>bocelliZoneSurfaces(points),[points]);
  useEffect(()=>()=>surfaces.forEach(g=>g.dispose()),[surfaces]);
  const box=(key:string,p:[number,number,number],size:[number,number,number],color:string)=><mesh key={key} position={p} raycast={()=>null}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.85}/></mesh>;
  return <group>
    {box('floor',[0,.12,0],[102,.16,67],'#59616a')}
    {BOCELLI_BLOCKS.map(b=><group key={b.zone}>
      {box(b.name,[b.x,.21,b.z],[b.width,.02,b.depth],b.color)}
      {overview&&<Text position={[b.x,.3,b.z+b.depth/2+.7]} rotation={[-Math.PI/2,0,0]} fontSize={1.1} color="white" raycast={()=>null}>{b.name.toUpperCase()}</Text>}
    </group>)}
    {box('stage',[0,.9,-46],[36,1.8,14],'#242c38')}
    {box('backdrop',[0,8,-51],[36,13,.5],'#18212d')}
    {box('canopy',[0,15,-46],[40,.5,17],'#303a4a')}
    {[-21,21].map(x=><group key={x}>
      {box(`screen-${x}`,[x,9,-47],[6,9,.6],'#405369')}
      {box(`support-${x}`,[x,7,-51],[.5,14,.5],'#78828e')}
      {box(`speaker-${x}`,[x*.83,10,-39.5],[1.3,6,1.5],'#111827')}
    </group>)}
    <Text position={[0,9,-50.65]} fontSize={2} color="#f1dcab" maxWidth={31} textAlign="center" raycast={()=>null}>{'ANDREA BOCELLI\nROMANZA'}</Text>
    {box('foh',[0,1.4,5],[4,2.4,5],'#222b39')}
    {overview&&surfaces.map((g,i)=><mesh key={i} geometry={g}
      onPointerMove={e=>{e.stopPropagation();onHover(i+12);}}
      onPointerOut={()=>onHover(null)}
      onClick={e=>{e.stopPropagation();if(e.delta>6||e.button!==0)return;
        let best:CrowdPoint|undefined,dist=Infinity;
        for(const p of points)if(p[4]===i+12){const d=(p[0]-e.point.x)**2+(p[2]-e.point.z)**2;if(d<dist){dist=d;best=p;}}
        if(best){onHover(null);onVisit(i+12,{position:[best[0],best[1],best[2]],rotY:best[3]});}
      }}><meshBasicMaterial color={zones[i+12]?.color} transparent opacity={selected===i+12 ? .32 : .12} side={THREE.DoubleSide} depthWrite={false}/></mesh>)}
  </group>;
}
