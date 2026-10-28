/** Provisional arrangement adapted from the user-supplied Maná plan.
 * Prices, rows and capacities are demonstration data, never official inventory.
 * X is left/right of stage; the audience faces negative Z.
 */
export const BOCELLI_SOURCE = 'https://www.smartticket.fun/es/event/andrea-bocelli-romanza-world-tour';
export const BOCELLI_REFERENCE = 'https://cdn-pro.elsalvador.com/wp-content/uploads/2024/02/mana-1.jpg';
export const BOCELLI_TARGET: [number, number, number] = [0, 4, -46];
const tiers = [
  {name:'Ultra Platinum',color:'#86bc42',price:150,z:-24},
  {name:'Platinum',color:'#499bd4',price:100,z:-5},
  {name:'VIP',color:'#f2c344',price:65,z:14},
];
export const BOCELLI_BLOCKS = tiers.flatMap((tier,t)=>['A','B','C','D'].map((block,b)=>({
  ...tier, name:`${tier.name} ${block}`, block, zone:t*4+b,
  x:-34.5+b*23, width:19, depth:14, rows:12, columns:20,
})));
export const BOCELLI_ZONES = [
  ...BOCELLI_BLOCKS.map(({name,color,price})=>({name,color,price})),
  {name:'General',color:'#54c4cd',price:35},
  {name:'Tribuna Baja',color:'#b65d7a',price:75},
  {name:'Tribuna Alta',color:'#9968c0',price:50},
];
export function bocelliSeats(){
  return BOCELLI_BLOCKS.flatMap(b=>Array.from({length:b.rows},(_,r)=>
    Array.from({length:b.columns},(_,n)=>({zone:b.zone,row:String(r+1).padStart(2,'0'),number:n+1,
      x:b.x+(n-(b.columns-1)/2)*.86,y:.65,z:b.z+(r-(b.rows-1)/2)*1.05,rotY:Math.PI}))).flat());
}
