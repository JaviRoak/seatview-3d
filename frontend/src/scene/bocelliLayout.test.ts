import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as THREE from 'three';
import {BOCELLI_BLOCKS,BOCELLI_ZONES,BOCELLI_TARGET,bocelliSeats} from './bocelliLayout';
import {eventTarget} from './eventTarget';
import {bocelliZoneSurfaces} from './BocelliProduction';
import type {CrowdMap} from './Crowd';
import type {VenueLayout} from '../api/types';

const stadium=JSON.parse(readFileSync(resolve(__dirname,'../../public/models/magico-seating.json'),'utf8'));
const crowd=JSON.parse(readFileSync(resolve(__dirname,'../../public/models/bocelli-crowd.json'),'utf8')) as CrowdMap;
describe('Bocelli en el Mágico González',()=>{
  it('mantiene los doce bloques frente al escenario, separados por pasillos y sin sillas en FOH',()=>{
    const seats=bocelliSeats();
    expect(BOCELLI_BLOCKS).toHaveLength(12);expect(BOCELLI_ZONES).toHaveLength(15);
    expect(new Set(seats.map(s=>`${s.zone}/${s.row}/${s.number}`)).size).toBe(2880);
    for(const s of seats){
      expect(Math.abs(s.x)).toBeLessThan(51);expect(Math.abs(s.z)).toBeLessThan(33.5);
      expect(s.z).toBeGreaterThan(-39);expect(Math.abs(s.x)).toBeGreaterThan(3);
      expect(Math.cos(s.rotY)).toBeCloseTo(-1);
    }
    expect(Math.max(...seats.filter(s=>s.zone<4).map(s=>s.z))).toBeLessThan(Math.min(...seats.filter(s=>s.zone>=4&&s.zone<8).map(s=>s.z)));
  });
  it('sincroniza capacidades y puntos reales de gradas; excluye la grada detrás del escenario',()=>{
    crowd.sectors.forEach((s,i)=>expect(crowd.points.filter(p=>p[4]===i)).toHaveLength(s.capacity));
    expect(crowd.points.filter(p=>p[4]>=12)).toHaveLength(stadium.points.length);
    for(const p of crowd.points.filter(p=>p[4]>=13))expect(p[2]).toBeGreaterThan(59);
    expect(stadium.points.some((p:number[])=>p[2]<-59&&Math.abs(p[0])<68)).toBe(false);
  });
  it('permite elegir gradas en su geometría y no sobre la cancha o los accesos vacíos',()=>{
    const surfaces=bocelliZoneSurfaces(crowd.points);
    const mesh=new THREE.Mesh(surfaces[1],new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    const p=crowd.points.find(p=>p[4]===13)!;
    expect(new THREE.Raycaster(new THREE.Vector3(p[0],60,p[2]),new THREE.Vector3(0,-1,0)).intersectObject(mesh).length).toBeGreaterThan(0);
    expect(new THREE.Raycaster(new THREE.Vector3(0,60,0),new THREE.Vector3(0,-1,0)).intersectObject(mesh)).toHaveLength(0);
    surfaces.forEach(g=>g.dispose());
  });
  it('orienta POV hacia este escenario sin cambiar el concierto Beéle',()=>{
    const layout={...stadium.layout,concert:{kind:'bocelli',demo:true}} as VenueLayout;
    expect(eventTarget(layout)).toEqual(BOCELLI_TARGET);
    expect(eventTarget({...layout,concert:{kind:'beele',demo:true}})[0]).toBe(39);
    expect(eventTarget({...layout,concert:undefined})).toEqual([0,.2,0]);
  });
  it('exporta un GLB autónomo, con pocos materiales y dentro del presupuesto web',()=>{
    const b=readFileSync(resolve(__dirname,'../../public/models/magico-concert.glb'));
    expect(b.toString('ascii',0,4)).toBe('glTF');
    const gltf=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
    expect(b.length).toBeLessThan(10*1024*1024);expect(gltf.meshes.length).toBeLessThan(30);
    expect(gltf.buffers.every((buffer:{uri?:string})=>!buffer.uri)).toBe(true);
    expect(gltf.meshes.some((m:{name:string})=>m.name.includes('Membrete'))).toBe(true);
  });
});
