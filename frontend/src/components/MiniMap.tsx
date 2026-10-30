/**
 * Minimapa (Cambio 2): vista superior esquemática del recinto con las zonas
 * en tonos suaves y un punto que marca la posición de la cámara.
 */
import { useMemo } from 'react';
import type { VenueLayout, Zone } from '../api/types';
import { contourPoint } from '../scene/contour';
import {buildZoneSurfaces} from '../scene/ClickableZones';

interface Props { layout: VenueLayout; zones: Zone[]; camera: { x: number; z: number } | null; focus?: { x: number; z: number } | null }

export function MiniMap({ layout, zones, camera, focus }: Props) {
  const last = layout.levels[layout.levels.length - 1];
  const R = last.baseOffset + last.rows * last.rowDepth + 4;
  const footprint = layout.model?.seatingFootprint ?? layout.field;
  const W = footprint.width + 2 * R, H = footprint.depth + 2 * R;
  const sx = (x: number) => ((x + W / 2) / W) * 150, sz = (z: number) => ((z + H / 2) / H) * 108;

  const bands = useMemo(() => {
    const out: Array<{ d: string; color: string; key: string }> = [];
    if(layout.admission&&layout.model){
      const geometry=buildZoneSurfaces(!!layout.concert);
      geometry.forEach((g,zi)=>{
        const p=g.getAttribute('position'),parts:string[]=[];
        for(let i=0;i<p.count;i+=12)parts.push(`M${[0,1,2,5].map(k=>`${sx(p.getX(i+k)).toFixed(2)},${sz(p.getZ(i+k)).toFixed(2)}`).join('L')}Z`);
        if(parts.length)out.push({d:parts.join(''),color:zones[zi]?.color??'#888',key:String(zi)});
        g.dispose();
      });
      return out;
    }
    const span = Math.PI / 2;
    layout.levels.forEach((lvl, li) => {
      for (let si = 0; si < 4; si++) {
        const zone = zones[li * 4 + si];
        const c = si * span, t0 = c - span / 2 + layout.aisleAngle, t1 = c + span / 2 - layout.aisleAngle;
        const dIn = lvl.baseOffset, dOut = lvl.baseOffset + lvl.rows * lvl.rowDepth;
        const pts: string[] = [];
        for (let i = 0; i <= 12; i++) { const p = contourPoint(layout, t0 + ((t1 - t0) * i) / 12, dIn); pts.push(`${sx(p.x)},${sz(p.z)}`); }
        for (let i = 12; i >= 0; i--) { const p = contourPoint(layout, t0 + ((t1 - t0) * i) / 12, dOut); pts.push(`${sx(p.x)},${sz(p.z)}`); }
        out.push({ d: `M${pts.join('L')}Z`, color: zone?.color ?? '#888', key: `${li}-${si}` });
      }
    });
    return out;
  }, [layout, zones]);

  return (
    <div className="card minimap" title="Vista superior del recinto" aria-label="Minimapa del evento">
      <svg viewBox="0 0 150 108" role="img" aria-label={layout.concert?'Mapa del concierto con escenario y posición de la cámara':'Mapa del estadio y posición de la cámara'}>
        <rect x="0" y="0" width="150" height="108" rx="8" fill="rgba(255,255,255,0.03)" />
        {layout.model&&<ellipse cx="75" cy="54" rx="69" ry="49" fill="#566171" fillOpacity=".25"/>}
        {bands.map((b) => <path key={b.key} d={b.d} fill={b.color} fillOpacity="0.55" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />)}
        {layout.concert?<>
          <rect x={sx(-38)} y={sz(-58)} width={76/W*150} height={116/H*108} fill="#767e8b"/>
          {[{x:2,w:28.7,z:0},{x:-20.2,w:21,z:1},{x:-35,w:14,z:2}].map(b=><rect key={b.z} x={sx(b.x)} y={sz(-54)} width={b.w/W*150} height={108/H*108} fill={zones[b.z]?.color}/>)}
          <rect x={sx(20)} y={sz(-27)} width={11/W*150} height={54/H*108} fill="#404957"/>
          <rect x={sx(-10)} y={sz(-4)} width={9/W*150} height={8/H*108} fill="#172133"/>
          <rect x={sx(33.5)} y={sz(-18)} width={11/W*150} height={36/H*108} fill="#101828" stroke="#fff" strokeWidth=".5"><title>Escenario</title></rect>
        </>:<>
          <rect x={sx(-layout.field.width / 2)} y={sz(-layout.field.depth / 2)} width={(layout.field.width / W) * 150} height={(layout.field.depth / H) * 108} fill="#2f7d47" rx="1" />
          <line x1={sx(0)} y1={sz(-layout.field.depth / 2)} x2={sx(0)} y2={sz(layout.field.depth / 2)} stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />
        </>}
        {focus && <circle cx={sx(focus.x)} cy={sz(focus.z)} r="3" fill="#ffb020" stroke="#1a1200" strokeWidth="0.8" />}
        {camera && <circle cx={sx(Math.max(-W / 2, Math.min(W / 2, camera.x)))} cy={sz(Math.max(-H / 2, Math.min(H / 2, camera.z)))} r="3.2" fill="#ffffff" stroke="#0d1626" strokeWidth="1" />}
      </svg>
    </div>
  );
}
