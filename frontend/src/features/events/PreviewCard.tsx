import type {ReactNode} from 'react';
import type {Direction} from '../../scene/seatNavigation';
import {Icon} from '../../components/Icon';

/** Shared presentation for assigned seats and unassigned zone previews. */
export function PreviewCard({title,subtitle,quality,description,stats,children}:{
  title:string;subtitle:ReactNode;quality?:ReactNode;description?:ReactNode;
  stats:{label:string;value:ReactNode}[];children:ReactNode;
}){
  return <section className="card" aria-label="Vista previa de la localidad">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'.5rem'}}>
      <span className="preview-tag"><span className="badge preview">Vista previa</span><span>Mirar no aparta el lugar.</span></span>{quality}
    </div>
    {description&&<div className="muted" style={{fontSize:'.8rem',marginTop:'.35rem'}}>{description}</div>}
    <h2 style={{margin:'.6rem 0 0',fontSize:'1.45rem'}}>{title}</h2>
    <div className="muted" style={{fontSize:'.9rem'}}>{subtitle}</div>
    <div className="stat-row" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>{stats.map(s=><div className="stat" key={s.label} style={{minWidth:0,overflowWrap:'anywhere'}}><span className="eyebrow">{s.label}</span><span className="value">{s.value}</span></div>)}</div>
    {children}
  </section>;
}

export function PreviewNavigation({canMove,onMove,onExit}:{canMove:(d:Direction)=>boolean;onMove:(d:Direction)=>void;onExit:()=>void}){
  return <div className="pov-nav" aria-label="Moverse a posiciones cercanas">
    <button aria-label="Al lado, a la izquierda" disabled={!canMove('left')} onClick={()=>onMove('left')}><Icon name="left" size={14}/>Al lado</button>
    <button disabled={!canMove('front')} onClick={()=>onMove('front')}><Icon name="up" size={14}/>Adelante</button>
    <button aria-label="Al lado, a la derecha" disabled={!canMove('right')} onClick={()=>onMove('right')}>Al lado<Icon name="right" size={14}/></button>
    <button className="wide" disabled={!canMove('back')} onClick={()=>onMove('back')}><Icon name="down" size={14}/>Fila atrás</button>
    <button className="wide btn-ghost" onClick={onExit}>Volver a la vista general</button>
  </div>;
}
