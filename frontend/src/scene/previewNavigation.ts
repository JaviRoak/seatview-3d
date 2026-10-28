import type {Direction} from './seatNavigation';

/** Nearest point within a directional cone, measured towards the event focal point. */
export function nearestInDirection(origin:[number,number],points:{id:number;x:number;z:number}[],direction:Direction,target:[number,number]):number|null{
  const dx=target[0]-origin[0],dz=target[1]-origin[1],length=Math.hypot(dx,dz)||1;
  const front=[dx/length,dz/length],right=[-front[1],front[0]];
  const axis=direction==='front'?front:direction==='back'?front.map(v=>-v):direction==='right'?right:right.map(v=>-v);
  let best:number|null=null,score=Infinity;
  for(const p of points){const x=p.x-origin[0],z=p.z-origin[1],along=x*axis[0]+z*axis[1],across=Math.abs(x*axis[1]-z*axis[0]);
    if(along<.15||across>along*.8)continue;
    const d=along*along+across*across*3;if(d<score){score=d;best=p.id;}
  }
  return best;
}
