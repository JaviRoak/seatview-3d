import {afterAll,describe,expect,it} from 'vitest';
import {BEELE_ZONES,beelePoint,beeleSector} from './beeleLayout';
import {buildZoneSurfaces} from './ClickableZones';

describe('distribución de Beéle',()=>{
  const surfaces=buildZoneSurfaces(true);
  afterAll(()=>surfaces.forEach(g=>g.dispose()));
  it('coloca el escenario al este y conserva el norte a la izquierda del plano',()=>{
    expect(beelePoint(1000,700)).toEqual([34.125,.7,0]);
    expect(beelePoint(700,1000)[2]).toBeLessThan(0);
    expect(beelePoint(1000,1340)[0]).toBeLessThan(0);
  });
  it('separa Platea y tribunas y excluye el público detrás del escenario',()=>{
    expect(beeleSector(-60,0)).toBe(8);
    expect(beeleSector(-60,-40)).toBe(7);
    expect(beeleSector(-60,40)).toBe(9);
    expect(beeleSector(60,0)).toBe(-1);
    expect(beeleSector(0,-80)).toBe(3);
    expect(beeleSector(-30,80)).toBe(6);
  });
  it('las superficies de gradas corresponden a las localidades del concierto',()=>{
    expect(surfaces).toHaveLength(BEELE_ZONES.length);
    for(let i=0;i<3;i++)expect(surfaces[i].getAttribute('position').count).toBe(0);
    for(let i=3;i<7;i++)expect(surfaces[i].getAttribute('position').count).toBe(0);
    for(let i=7;i<10;i++)expect(surfaces[i].getAttribute('position').count).toBeGreaterThan(0);
  });
});
