/** Map orientation: stage on the east side, north to its left, Platea opposite. */
export const BEELE_ZONES = [
  {name:'Ultra Platinum',color:'#bb91e2',price:150},
  {name:'Platinum',color:'#70c8d7',price:95},
  {name:'VIP',color:'#e3bf75',price:75},
  {name:'General Norte',color:'#657180',price:0},
  {name:'General Sur',color:'#657180',price:0},
  {name:'Sombra Norte',color:'#657180',price:0},
  {name:'Sombra Sur',color:'#657180',price:0},
  {name:'Tribuna Norte',color:'#3797cc',price:35},
  {name:'Platea',color:'#63bddf',price:60},
  {name:'Tribuna Sur',color:'#3797cc',price:35},
];
export const BEELE_TARGET: [number,number,number] = [39,4,0];
export const BEELE_CLOSED = [3,4,5,6];
export function beeleSector(x:number,z:number) {
  if(x>0&&Math.abs(z)<Math.abs(x)*1.5)return -1; // behind the stage
  if(x>-15)return z<0?3:4;
  if(Math.abs(z)>Math.abs(x)*1.25)return z<0?5:6;
  if(Math.abs(z)<23)return 8;
  return z<0?7:9;
}
export function beelePoint(x:number,y:number): [number,number,number] {
  return [(1025-y)*.105,.7,(x-1000)*.13];
}
