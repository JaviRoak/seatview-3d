import {useCallback,useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import type {EventDetail} from '../../api/types';
import {eventsApi,locksApi} from '../../api';
import {useAuthStore} from '../../store/auth';
import {useSeatsStore} from '../../store/seats';
import {useSeatSocket} from '../../sockets/useSeatSocket';
import {SeatScene} from '../../scene/SeatScene';
import {consumeDragFlag,type PovTarget} from '../../scene/CameraController';
import {Crowd,PlateaSeats,crowdPoints,type CrowdMap} from '../../scene/Crowd';
import {detectQuality} from '../../scene/quality';
import {FpsOverlay,type FpsSample} from '../../scene/FpsMeter';
import {MiniMap} from '../../components/MiniMap';
import {HelpPopover} from '../../components/HelpPopover';
import {SeatCard} from './SeatCard';
import {ZonePreviewCard} from './ZonePreviewCard';
import {ReservationCard} from './ReservationCard';
import {ClickableZones} from '../../scene/ClickableZones';
import {ConcertProduction,type ConcertTable} from '../../scene/ConcertProduction';
import {nearestNumberedSeat} from '../../scene/nearestNumberedSeat';
import {EventInfoCard} from '../../components/EventInfoCard';
import {BocelliProduction} from '../../scene/BocelliProduction';
import {BocelliMiniMap} from '../../components/BocelliMiniMap';
import {BOCELLI_REFERENCE,BOCELLI_SOURCE} from '../../scene/bocelliLayout';

export function ZoneEventPage({event}:{event:EventDetail}){
  const beele=event.venue.layout.concert?.kind==='beele';
  const bocelli=event.venue.layout.concert?.kind==='bocelli';
  const concert=!!event.venue.layout.concert;
  const navigate=useNavigate(),user=useAuthStore(s=>s.user),data=useSeatsStore(s=>s.data),version=useSeatsStore(s=>s.version);
  const {connected}=useSeatSocket(event.id);
  const [map,setMap]=useState<CrowdMap|null>(null),[zone,setZone]=useState(0),[quantity,setQuantity]=useState(1),[error,setError]=useState(''),[busy,setBusy]=useState(false),[pov,setPov]=useState<PovTarget|null>(null),[focused,setFocused]=useState<number|null>(null),[showCrowd,setShowCrowd]=useState(true),[fps,setFps]=useState<FpsSample|null>(null),[row,setRow]=useState('');
  const quality=detectQuality(), debug=new URLSearchParams(location.search).get('debug')==='1';
  const [simulation,setSimulation]=useState<number|null>(null);
  const [hoveredZone,setHoveredZone]=useState<number|null>(null);
  const [camera,setCamera]=useState<{x:number;z:number}|null>(null);
  const onCameraMove=useCallback((x:number,z:number)=>setCamera(prev=>prev&&Math.abs(prev.x-x)<.5&&Math.abs(prev.z-z)<.5?prev:{x,z}),[]);
  const exitPov=useCallback(()=>{setPov(null);setFocused(null);useSeatsStore.getState().setFocused(null);},[]);
  const chooseZone=useCallback((next:number)=>{setZone(next);setFocused(null);setRow('');setPov(null);setError('');useSeatsStore.getState().setFocused(null);},[]);
  const visitZone=useCallback((next:number,target:PovTarget)=>{
    const st=useSeatsStore.getState(),d=st.data;
    const idx=d&&!d.zones[next]?.generalAdmission?nearestNumberedSeat(d,next,target.position):null;
    setZone(next);setFocused(idx);st.setFocused(idx);setError('');
    if(d&&idx!==null){
      setRow(d.rows[idx]);
      setPov({position:[d.positions[idx*3],d.positions[idx*3+1],d.positions[idx*3+2]],rotY:d.rotations[idx]});
    }else{setRow('');setPov(target);}
  },[]);
  useEffect(()=>{
    let active=true;useSeatsStore.getState().reset();
    Promise.all([eventsApi.seats(event.id),fetch(event.venue.layout.admission!.crowdUrl).then(r=>{if(!r.ok)throw Error('No se pudo cargar la vista de zonas');return r.json() as Promise<CrowdMap>;})]).then(async([payload,crowd])=>{
      if(!active)return;useSeatsStore.getState().load(event.id,payload);setMap(crowd);
      if(user){const {locks}=await locksApi.mine(event.id);if(!active)return;const st=useSeatsStore.getState();locks.forEach(l=>{const i=st.data?.idToIdx.get(l.eventSeatId);if(i!==undefined)st.select(i,l.ttl);});}
    }).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[event.id,event.venue.layout.admission?.crowdUrl,user?.id]);
  const stats=useMemo(()=>{
    const totals=event.venue.zones.map(()=>({sold:0,locked:0,available:0}));
    if(data){const status=useSeatsStore.getState().status;for(let i=0;i<data.count;i++){const z=totals[data.zoneIdx[i]];if(z){if(status[i]===2)z.sold++;else if(status[i]===1)z.locked++;else z.available++;}}}
    return totals;
  },[data,version,event]);
  const people=useMemo(()=>map?crowdPoints(map,stats.map((s,i)=>simulation===null?s.sold:Math.floor(map.sectors[i].capacity*simulation/100)),quality==='low'?2000:10000):[],[map,stats,quality,simulation]);
  const numbered=useMemo(()=>data?data.rows.flatMap((r,i)=>r!=='GA'&&data.zoneIdx[i]===zone?[i]:[]):[],[data,zone]);
  const rowNames=useMemo(()=>Array.from(new Set(numbered.map(i=>data!.rows[i]))),[numbered,data]);
  const activeRow=rowNames.includes(row)?row:rowNames[0];
  const sit=useCallback((i:number)=>{const st=useSeatsStore.getState(),d=st.data;if(!d||consumeDragFlag())return;setZone(d.zoneIdx[i]);setFocused(i);st.setFocused(i);setRow(d.rows[i]);setError('');setPov({position:[d.positions[i*3],d.positions[i*3+1],d.positions[i*3+2]],rotY:d.rotations[i]});},[]);
  const explore=(level:number)=>{
    const points=map?.points.filter(p=>p[4]===zone).sort((a,b)=>a[1]-b[1]);
    if(!points?.length)return;
    const p=points[Math.min(points.length-1,Math.floor(points.length*level))];setPov({position:[p[0],p[1],p[2]],rotY:p[3]});setFocused(null);
  };
  const reserve=async(index=focused)=>{
    if(!user)return navigate('/ingresar',{state:{from:`/eventos/${event.id}`}});
    if(!data)return;setBusy(true);setError('');
    try{
      const locks=event.venue.zones[zone].generalAdmission
        ? (await locksApi.zone(event.id,event.venue.zones[zone].id,quantity)).locks
        : index===null?[]:[await locksApi.acquire(event.id,data.ids[index])];
      const st=useSeatsStore.getState();locks.forEach(l=>{const i=st.data?.idToIdx.get(l.eventSeatId);if(i!==undefined)st.select(i,l.ttl);});
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const release=async(indices:number[])=>{setBusy(true);setError('');try{for(const i of indices){await locksApi.release(event.id,data!.ids[i]);useSeatsStore.getState().deselect(i);}}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  if(!data||!map)return <main className="page"><p role={error?'alert':'status'}>{error||'Cargando zonas…'}</p></main>;
  const current=event.venue.zones[zone],counts=stats[zone],totalSold=stats.reduce((n,s)=>n+s.sold,0);
  const goToReservation=(i:number)=>{if(data.rows[i]!=='GA'){sit(i);return;}const zi=data.zoneIdx[i],points=map.points.filter(p=>p[4]===zi),p=points[Math.floor(points.length/2)];if(p)visitZone(zi,{position:[p[0],p[1],p[2]],rotY:p[3]});};
  return <div className="event-layout">
    <SeatScene layout={event.venue.layout} pov={pov} debug={debug} quality={quality} onSelect={sit} onHover={()=>{}} onFps={setFps} onCameraMove={onCameraMove}>
      {!bocelli&&<ClickableZones zones={event.venue.zones} selected={zone} enabled={pov===null} onSelect={visitZone} onHover={setHoveredZone} concert={beele}/>}
      {beele&&<ConcertProduction tables={(map as CrowdMap&{tables:ConcertTable[]}).tables??[]} overview={pov===null} onVisit={visitZone}/>}
      {bocelli&&<BocelliProduction points={map.points} zones={event.venue.zones} selected={zone} overview={pov===null} onVisit={visitZone} onHover={setHoveredZone}/>}
      <PlateaSeats onSelect={sit} concert={beele}/>{showCrowd&&<Crowd points={people}/>}
    </SeatScene>
    <div className="hud-tl"><EventInfoCard event={event} seats={data.count} available={stats.reduce((n,s)=>n+s.available,0)} connected={connected} crowd={{visible:showCrowd,onChange:setShowCrowd}}>
      <p>{data.count.toLocaleString('es')} cupos · {totalSold.toLocaleString('es')} entradas vendidas.</p>
      {beele&&<p>Cupos de prueba en gradas; precios base sin cargo de boletería. Palcos fuera de venta. <a href="https://www.smartticket.fun/es/map/beele/100" target="_blank" rel="noreferrer">Mapa de referencia</a></p>}
      {bocelli&&<p>Palcos fuera de venta. <a href={BOCELLI_REFERENCE} target="_blank" rel="noreferrer">Plano de Maná usado como referencia</a> · <a href={BOCELLI_SOURCE} target="_blank" rel="noreferrer">Concierto en Smartticket</a></p>}
      <p>El público ilustra ventas por zona, no asistencia ni lugares reservados. {showCrowd?people.length.toLocaleString('es'):0} figuras visibles.</p>
      {debug&&<div><label htmlFor="crowd-simulation">Prueba gráfica: {simulation===null?'ventas actuales':`${simulation}% · simulación`}</label><input id="crowd-simulation" type="range" min="0" max="100" value={simulation??0} onChange={e=>setSimulation(Number(e.target.value))}/><button className="btn-ghost" onClick={()=>setSimulation(null)}>Usar ventas actuales</button><p className="notice">La simulación no cambia ventas ni disponibilidad.</p></div>}
    </EventInfoCard>{debug&&<FpsOverlay sample={fps} seats={people.length} quality={quality} unit="figuras"/>}</div>
    <div className="hud-bl">{bocelli?<BocelliMiniMap points={map.points} camera={camera} focus={pov?{x:pov.position[0],z:pov.position[2]}:null}/>:<MiniMap layout={event.venue.layout} zones={event.venue.zones} camera={camera} focus={pov?{x:pov.position[0],z:pov.position[2]}:null}/>}<HelpPopover/></div>
    <aside className="hud-tr">
    {pov&&focused!==null?<SeatCard event={event} idx={focused} busy={busy} onReserve={i=>void reserve(i)} onRelease={i=>void release([i])} onMove={sit} onExit={exitPov}/>
      :pov?<ZonePreviewCard event={event} zone={zone} position={pov} points={map.points} quantity={quantity} onQuantity={setQuantity} available={counts.available} busy={busy} onReserve={()=>void reserve()} onMove={setPov} onExit={exitPov}/>
      :<section className="card card-tight">
      <label htmlFor="event-zone" className="panel-title">Elige tu zona</label>
      <p className="notice" role="status" style={{margin:'.4rem 0'}}>{pov?'Estás en el punto elegido. Arrastra para mirar alrededor.':hoveredZone===null?`Haz clic en ${concert?'una silla o grada para ver el escenario':'una grada para ver la cancha'} desde ese punto.`:`${event.venue.zones[hoveredZone].name} · Clic para ver desde aquí`}</p>
      <select id="event-zone" value={zone} onChange={e=>chooseZone(Number(e.target.value))} style={{width:'100%',margin:'.5rem 0'}}>{event.venue.zones.map((z,i)=>concert&&z.capacity===0?null:<option key={z.id} value={i}>{z.name}</option>)}</select>
      <div style={{display:'flex',justifyContent:'space-between',gap:'.5rem',flexWrap:'wrap'}}><strong>${current.price.toFixed(2)} / entrada{bocelli?' · prueba':''}</strong><span>{counts.available.toLocaleString('es')} disponibles</span></div>
      <p className="notice">{counts.sold.toLocaleString('es')} vendidas · {counts.locked} en reserva · Aforo {(current.capacity??0).toLocaleString('es')}</p>
      {current.generalAdmission?<>
        <p>Acceso a gradas corridas. No incluye un asiento ni una ubicación asignada.</p>
        <label htmlFor="zone-quantity">Cantidad de entradas</label><input id="zone-quantity" type="number" min="1" max="6" value={quantity} onChange={e=>setQuantity(Number(e.target.value))} style={{width:'100%',margin:'.5rem 0'}}/>
        <button className="btn-primary btn-lg" disabled={busy||!Number.isInteger(quantity)||quantity<1||quantity>6||quantity>counts.available} onClick={()=>void reserve()}>{busy?'Apartando…':`Apartar ${quantity} ${quantity===1?'entrada':'entradas'} · $${(current.price*quantity).toFixed(2).replace(/\.00$/,'')}`}</button>
        <p className="notice">Explora la vista; el punto que mires no se reserva.</p><div className="row-actions">{[['Baja',.15],['Media',.5],['Alta',.85]].map(([name,f])=><button key={String(name)} className="btn" onClick={()=>explore(Number(f))}>Vista {name}</button>)}</div>
      </>:<>
        <p>{beele?zone<2?'Sillas en mesas numeradas. El precio corresponde a una silla.':'VIP con sillas numeradas en bloques A–F.':bocelli?'Sillas numeradas de prueba en bloques A–D.':'Platea con lugares numerados.'} Elige una silla en el modelo o en la lista.</p>
        <label htmlFor="platea-row">{beele&&zone<2?'Mesa':'Fila'}</label><select id="platea-row" value={activeRow} onChange={e=>{setRow(e.target.value);setFocused(null);}} style={{width:'100%'}}>{rowNames.map(r=><option key={r} value={r}>{beele&&r.startsWith('M')?`Mesa ${Number(r.slice(1))}`:beele?`Bloque ${r[0]} · Fila ${Number(r.slice(1))}`:r}</option>)}</select>
        <label htmlFor="platea-seat">Asiento</label><select id="platea-seat" value={focused??''} onChange={e=>{if(e.target.value!=='')sit(Number(e.target.value));}} style={{width:'100%',margin:'.5rem 0'}}><option value="">Selecciona un asiento</option>{numbered.filter(i=>data.rows[i]===activeRow).map(i=><option key={i} value={i}>{data.numbers[i]}{useSeatsStore.getState().status[i]===2?' · Vendido':useSeatsStore.getState().status[i]===1?' · En reserva':''}</option>)}</select>
      </>}
    </section>}
    {error&&<p className="card error" role="alert">{error}</p>}
    <ReservationCard busy={busy} onRelease={i=>void release([i])} onGoTo={goToReservation} onCheckout={()=>navigate(`/eventos/${event.id}/pago`)}/>
    </aside>
  </div>;
}
