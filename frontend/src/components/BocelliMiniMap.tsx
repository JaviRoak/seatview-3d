import type {CrowdPoint} from '../scene/Crowd';
import {BOCELLI_BLOCKS,BOCELLI_ZONES} from '../scene/bocelliLayout';

export function BocelliMiniMap({points,camera,focus}:{points:CrowdPoint[];camera:{x:number;z:number}|null;focus?:{x:number;z:number}|null}){
  return <div className="card minimap" title="Distribución provisional basada en Maná">
    <svg viewBox="-145 -100 290 220" role="img" aria-label="Mapa provisional de Bocelli con escenario y posición de la cámara">
      <rect x={-145} y={-100} width={290} height={220} rx={10} fill="#172332"/>
      {points.filter((p,i)=>p[4]>=12&&i%3===0).map((p,i)=><circle key={i} cx={p[0]} cy={p[2]} r={1.6} fill={BOCELLI_ZONES[p[4]].color}/>)}
      {BOCELLI_BLOCKS.map(b=><rect key={b.zone} x={b.x-b.width/2} y={b.z-b.depth/2} width={b.width} height={b.depth} fill={b.color}><title>{b.name}</title></rect>)}
      <rect x={-18} y={-53} width={36} height={14} fill="#faf3df"/><text x={0} y={-58} fontSize={7} textAnchor="middle" fill="white">ESCENARIO</text>
      {focus&&<circle cx={focus.x} cy={focus.z} r={4} fill="#ffd60a"/>}
      {camera&&<circle cx={Math.max(-140,Math.min(140,camera.x))} cy={Math.max(-95,Math.min(115,camera.z))} r={4} fill="white" stroke="#102033"/>}
    </svg>
  </div>;
}
