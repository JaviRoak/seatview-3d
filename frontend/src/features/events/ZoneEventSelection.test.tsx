import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import type {ReactNode} from 'react';
import type {EventDetail,EventSeatsPayload} from '../../api/types';
import {eventsApi,locksApi} from '../../api';
import {useAuthStore} from '../../store/auth';
import {useSeatsStore} from '../../store/seats';
import {ZoneEventPage} from './ZoneEventPage';

vi.mock('../../api',()=>({eventsApi:{seats:vi.fn()},locksApi:{mine:vi.fn(),acquire:vi.fn(),zone:vi.fn(),release:vi.fn()}}));
vi.mock('../../sockets/useSeatSocket',()=>({useSeatSocket:()=>({connected:true})}));
vi.mock('../../scene/quality',()=>({detectQuality:()=> 'high'}));
vi.mock('../../scene/SeatScene',()=>({SeatScene:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('../../scene/ClickableZones',()=>({ClickableZones:({onSelect}:any)=><button onClick={()=>onSelect(3,{position:[-60,8,40],rotY:0})}>Clic en grada</button>}));
vi.mock('../../scene/ConcertProduction',()=>({ConcertProduction:({onVisit}:any)=><>{['Ultra Platinum','Platinum','VIP'].map((name,i)=><button key={name} onClick={()=>onVisit(i,{position:[9.8,.25,i*3],rotY:0})}>Clic en {name}</button>)}</>}));
vi.mock('../../scene/Crowd',()=>({PlateaSeats:()=>null,Crowd:()=>null,crowdPoints:()=>[]}));
vi.mock('../../components/MiniMap',()=>({MiniMap:()=>null}));
vi.mock('../../components/BocelliMiniMap',()=>({BocelliMiniMap:()=>null}));
vi.mock('../../scene/BocelliProduction',()=>({BocelliProduction:()=>null}));

const names=['Ultra Platinum','Platinum','VIP','Tribuna Sur'];
const zones=names.map((name,i)=>({id:`z${i}`,name,color:'#70c8d7',price:i<3?95:35,generalAdmission:i===3,capacity:i<3?2:1}));
const event:EventDetail={id:'beele-test',name:'Beéle',date:'2026-12-11T03:00:00Z',category:'CONCIERTO',coverImageUrl:null,description:null,venue:{id:'v',name:'Cuscatlán',city:'San Salvador',imageUrl:null,zones,layout:{concert:{kind:'beele',demo:true},admission:{mode:'mixed',crowdUrl:'/models/beele-crowd.json'},field:{width:68,depth:107},corner:.84,seatPitch:1,aisleAngle:.01,stands:['E','N','O','S'],levels:[{name:'Nivel 1',rows:40,rowDepth:.78,rowRise:.46,baseHeight:1.4,baseOffset:1}]}}};
const payload:EventSeatsPayload={eventId:event.id,count:7,ids:['u1','u2','p1','p2','v1','v2','ga'],seatIds:['u1','u2','p1','p2','v1','v2','ga'],zoneIdx:[0,0,1,1,2,2,3],rows:['M001','M001','M010','M010','A01','A01','GA'],numbers:[1,2,1,2,1,2,9876],positions:[0,.7,0,10,.7,0,0,.7,3,10,.7,3,0,.7,6,10,.7,6,0,0,0],rotations:Array(7).fill(0),status:Array(7).fill(0),lockedBy:{},zones,viewPct:Array(7).fill(50),viewRange:{dMin:0,dMax:100}};
beforeEach(()=>{
  vi.clearAllMocks();useSeatsStore.getState().reset();
  useAuthStore.setState({user:{id:'test-user',email:'test@example.test',name:'Test',role:'USER'},token:null});
  vi.mocked(eventsApi.seats).mockResolvedValue(payload);
  vi.mocked(locksApi.mine).mockResolvedValue({locks:[]});
  vi.mocked(locksApi.acquire).mockImplementation(async(_,id)=>({eventSeatId:id,ttl:300,renewed:false}));
  vi.mocked(locksApi.zone).mockResolvedValue({locks:[{eventSeatId:'ga',ttl:300}]});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({sectors:zones.map(z=>({name:z.name,capacity:z.capacity})),points:[[-60,8,40,0,3]],tables:[]})}));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();useSeatsStore.getState().reset();useAuthStore.setState({user:null,token:null});});
async function open(){render(<MemoryRouter><ZoneEventPage event={event}/></MemoryRouter>);await screen.findByLabelText('Elige tu zona');}

describe('clic en cancha → silla real → apartado',()=>{
  it('Bocelli usa filas numeradas y muestra la advertencia de importes y plano de prueba',async()=>{
    const bocelli={...event,id:'andrea-bocelli-magico-2026',name:'Andrea Bocelli',venue:{...event.venue,layout:{...event.venue.layout,concert:{kind:'bocelli' as const,demo:true}}}};
    vi.mocked(eventsApi.seats).mockResolvedValue({...payload,rows:['01','01','01','01','01','01','GA']});
    render(<MemoryRouter><ZoneEventPage event={bocelli}/></MemoryRouter>);
    await screen.findByLabelText('Elige tu zona');
    expect(screen.getByText(/Plano provisional basado en Maná/)).toBeVisible();
    expect(screen.getByText(/95\.00 \/ entrada · prueba/)).toBeVisible();
    expect(screen.queryByLabelText('Mesa')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Asiento'),{target:{value:'1'}});
    fireEvent.click(screen.getByRole('button',{name:'Apartar este asiento'}));
    await waitFor(()=>expect(locksApi.acquire).toHaveBeenCalledWith(bocelli.id,'u2'));
  });
  it.each([[0,'u2'],[1,'p2'],[2,'v2']])('resuelve la localidad %i y aparta la silla exacta',async(zi,id)=>{
    await open();fireEvent.click(screen.getByRole('button',{name:`Clic en ${names[Number(zi)]}`}));
    expect(screen.getByRole('button',{name:'Apartar este asiento'})).toBeEnabled();
    expect(useSeatsStore.getState().focused).toBe(Number(zi)*2+1);
    expect(locksApi.acquire).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Apartar este asiento'}));
    await waitFor(()=>expect(locksApi.acquire).toHaveBeenCalledWith(event.id,id));
    expect(await screen.findByRole('button',{name:'Quitar de mi reserva'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/^Pagar \$/})).toBeInTheDocument();
  });
  it('no habilita el apartado si la silla más cercana ya está vendida',async()=>{
    vi.mocked(eventsApi.seats).mockResolvedValue({...payload,status:[0,2,0,0,0,0,0]});
    await open();fireEvent.click(screen.getByRole('button',{name:'Clic en Ultra Platinum'}));
    expect(screen.getByRole('button',{name:'Apartar este asiento'})).toBeDisabled();
    expect(screen.getByText(/^Vendido. Prueba el de al lado/)).toBeInTheDocument();expect(locksApi.acquire).not.toHaveBeenCalled();
  });
  it('conserva el apartado por cantidad en gradas sin inventar un asiento',async()=>{
    await open();fireEvent.click(screen.getByRole('button',{name:'Clic en grada'}));
    expect(useSeatsStore.getState().focused).toBeNull();expect(screen.queryByText('9876')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:/^Apartar 1 entrada/}));
    await waitFor(()=>expect(locksApi.zone).toHaveBeenCalledWith(event.id,'z3',1));expect(locksApi.acquire).not.toHaveBeenCalled();
  });
});
