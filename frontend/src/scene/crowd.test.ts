import {describe,it,expect} from 'vitest';
import {buildPersonGeometry,crowdPoints,type CrowdMap} from './Crowd';
describe('público ilustrativo',()=>{
  const map:CrowdMap={sectors:[{name:'Sol',capacity:50},{name:'Sombra',capacity:50}],points:Array.from({length:100},(_,i)=>[i,1,0,0,i<50?0:1])};
  it('respeta cupos vendidos y no repite posiciones al limitar la muestra',()=>{
    expect(crowdPoints(map,[0,0],20)).toEqual([]);
    const p=crowdPoints(map,[20,40],15);
    expect(p).toHaveLength(15);expect(new Set(p.map(p=>p[0])).size).toBe(15);
    expect(p.filter(p=>p[4]===0)).toHaveLength(5);
    expect(crowdPoints(map,[300,400],200)).toHaveLength(100);
  });
  it('mantiene las figuras anteriores cuando crecen las ventas sin llegar al límite',()=>{
    const a=crowdPoints(map,[5,0],100),b=crowdPoints(map,[10,0],100);
    expect(b.slice(0,5)).toEqual(a);
  });
  it('usa una sola geometría con 44 triángulos por persona',()=>{
    const g=buildPersonGeometry();expect(g.getAttribute('position').count/3).toBe(44);g.dispose();
  });
});
