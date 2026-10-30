import type {EventDetail} from '../../api/types';
import type {PovTarget} from '../../scene/CameraController';
import type {CrowdPoint} from '../../scene/Crowd';
import {nearestInDirection} from '../../scene/previewNavigation';
import {PreviewCard,PreviewNavigation} from './PreviewCard';
import {eventTargetXZ} from '../../scene/eventTarget';

export function ZonePreviewCard({event,zone,position,points,quantity,onQuantity,available,busy,onReserve,onMove,onExit}:{
  event:EventDetail;zone:number;position:PovTarget;points:CrowdPoint[];quantity:number;onQuantity:(n:number)=>void;available:number;busy:boolean;onReserve:()=>void;onMove:(target:PovTarget)=>void;onExit:()=>void;
}){
  const current=event.venue.zones[zone],ga=current.generalAdmission;
  const candidates=points.map((p,id)=>({id,x:p[0],z:p[2]})).filter(p=>points[p.id][4]===zone);
  const neighbors=Object.fromEntries((['left','right','front','back'] as const).map(d=>[d,nearestInDirection([position.position[0],position.position[2]],candidates,d,eventTargetXZ(event.venue.layout))]));
  return <PreviewCard title={current.name} subtitle={<><span className="zone-chip" style={{background:current.color}}/>{event.venue.name}</>}
    description={ga?'Esta vista es orientativa; la entrada no asigna una ubicación.':'Vista de la zona. Elige una silla para apartar un lugar numerado.'}
    stats={[{label:'Acceso',value:ga?'Por zona':'Numerado'},{label:'Disponibles',value:available.toLocaleString('es')},{label:event.venue.layout.concert?.kind==='bocelli'?'Precio prueba':'Precio',value:`$${current.price.toFixed(2).replace(/\.00$/,'')}`}]}>
    <ul className="attr-list"><li>{event.venue.layout.concert?'Vista hacia el escenario':'Vista hacia la cancha'}<span style={{marginLeft:'auto'}}>✓</span></li><li>{ga?'Sin asiento asignado':'Silla numerada'}<span style={{marginLeft:'auto'}}>✓</span></li></ul>
    {ga&&<><label htmlFor="preview-quantity">Cantidad de entradas</label><input id="preview-quantity" type="number" min={1} max={6} value={quantity} onChange={e=>onQuantity(Number(e.target.value))}/>
      <button className="btn-primary btn-lg" disabled={busy||!Number.isInteger(quantity)||quantity<1||quantity>6||quantity>available} onClick={onReserve}>{busy?'Apartando…':`Apartar ${quantity} ${quantity===1?'entrada':'entradas'}`}</button></>}
    <PreviewNavigation canMove={d=>neighbors[d]!=null} onMove={d=>{const i=neighbors[d];if(i!=null){const p=points[i];onMove({position:[p[0],p[1],p[2]],rotY:p[3]});}}} onExit={onExit}/>
  </PreviewCard>;
}
