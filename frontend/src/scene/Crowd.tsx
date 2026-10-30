import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useSeatsStore } from '../store/seats';
import { buildSeatGeometry } from './SeatsInstanced';
import { useSeatInstanceColors } from './useSeatInstanceColors';

export type CrowdPoint = [number,number,number,number,number];
export interface CrowdMap { sectors: {name:string;capacity:number}[]; points:CrowdPoint[] }
export function buildPersonGeometry() {
  const head = new THREE.IcosahedronGeometry(.15,0); head.translate(0,.78,0);
  const torso = new THREE.CylinderGeometry(.19,.25,.43,6,1); torso.translate(0,.39,0);
  const torsoFlat=torso.toNonIndexed();
  const merged=mergeGeometries([head,torsoFlat],false)!;
  head.dispose();torso.dispose();torsoFlat.dispose();return merged;
}
// Occupancy illustration: deterministic scattered samples, never assigned positions.
export function crowdPoints(map:CrowdMap,counts:number[],limit:number):CrowdPoint[]{
  const groups=map.sectors.map((_,i)=>map.points.filter(p=>p[4]===i));
  const targets=groups.map((g,i)=>Math.min(g.length,Math.max(0,Math.ceil(g.length*(counts[i]??0)/Math.max(1,map.sectors[i].capacity)))));
  const total=targets.reduce((a,b)=>a+b,0), result:CrowdPoint[]=[];
  let allocated=0,cumulative=0;
  groups.forEach((g,i)=>{
    cumulative+=targets[i]; const end=total>limit?Math.floor(cumulative/total*limit):cumulative;
    const n=end-allocated;allocated=end;
    // Hash-sort once per update so growth adds people without moving earlier ones.
    const shuffled=g.map((p,j)=>({p,key:Math.imul(j+1,2654435761)>>>0})).sort((a,b)=>a.key-b.key);
    for(let j=0;j<n;j++)result.push(shuffled[j].p);
  });return result;
}
export function Crowd({points}:{points:CrowdPoint[]}){
  const mesh=useRef<THREE.InstancedMesh>(null), geometry=useMemo(buildPersonGeometry,[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useEffect(()=>{
    if(!mesh.current)return;
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),scale=new THREE.Vector3(1,1,1);
    const colors=['#70dcd7','#63bedf','#a4e9b9','#c2eaf0'];
    points.forEach((point,i)=>{p.set(point[0],point[1]-.35,point[2]);q.setFromAxisAngle(up,point[3]);mesh.current!.setMatrixAt(i,m.compose(p,q,scale));mesh.current!.setColorAt(i,new THREE.Color(colors[i%colors.length]));});
    mesh.current.count=points.length;mesh.current.instanceMatrix.needsUpdate=true;if(mesh.current.instanceColor)mesh.current.instanceColor.needsUpdate=true;
    mesh.current.computeBoundingSphere();
  },[points]);
  return <instancedMesh ref={mesh} args={[geometry,undefined,10000]} frustumCulled={false} raycast={()=>null}><meshPhongMaterial shininess={75} specular="#d8ffff" /></instancedMesh>;
}
export function PlateaSeats({onSelect,concert=false}:{onSelect:(index:number)=>void;concert?:boolean}){
  const data=useSeatsStore(s=>s.data), mesh=useRef<THREE.InstancedMesh>(null);
  const geometry=useMemo(buildSeatGeometry,[]);
  const indices=useMemo(()=>data?data.rows.flatMap((r,i)=>r!=='GA'?[i]:[]):[],[data]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useEffect(()=>{
    if(!mesh.current||!data)return;
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),scale=new THREE.Vector3(concert?.65:1,1,concert?.65:1);
    indices.forEach((idx,k)=>{q.setFromAxisAngle(up,data.rotations[idx]);mesh.current!.setMatrixAt(k,m.compose(new THREE.Vector3().fromArray(data.positions,idx*3),q,scale));});
    mesh.current.count=indices.length;mesh.current.instanceMatrix.needsUpdate=true;mesh.current.computeBoundingSphere();
  },[data,indices,concert]);
  useSeatInstanceColors(mesh,data,indices);
  useEffect(()=>()=>useSeatsStore.getState().setHovered(null),[]);
  if(!indices.length)return null;
  return <instancedMesh ref={mesh} args={[geometry,undefined,indices.length]} frustumCulled={false}
    onPointerMove={e=>{e.stopPropagation();useSeatsStore.getState().setHovered(e.instanceId===undefined?null:indices[e.instanceId]??null);}}
    onPointerOut={()=>useSeatsStore.getState().setHovered(null)}
    onClick={e=>{e.stopPropagation();if(e.delta<=6&&e.button===0&&e.instanceId!==undefined){useSeatsStore.getState().setHovered(null);onSelect(indices[e.instanceId]);}}}><meshLambertMaterial /></instancedMesh>;
}
