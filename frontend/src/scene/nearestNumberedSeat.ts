import type {SeatData} from '../store/seats';

/** Resolve area clicks to an actual inventory seat in that same zone. */
export function nearestNumberedSeat(data:SeatData,zone:number,point:readonly [number,number,number]):number|null{
  let closest:number|null=null,distance=Infinity;
  for(let i=0;i<data.count;i++){
    if(data.zoneIdx[i]!==zone||data.rows[i]==='GA')continue;
    const d=(data.positions[i*3]-point[0])**2+(data.positions[i*3+1]-point[1])**2+(data.positions[i*3+2]-point[2])**2;
    if(d<distance){closest=i;distance=d;}
  }
  return closest;
}
