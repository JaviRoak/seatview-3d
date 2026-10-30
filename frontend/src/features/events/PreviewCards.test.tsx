import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import type {EventDetail,EventSeatsPayload} from '../../api/types';
import {useSeatsStore} from '../../store/seats';
import {SeatCard} from './SeatCard';
import {ZonePreviewCard} from './ZonePreviewCard';
import {ReservationCard} from './ReservationCard';
import {MiniMap} from '../../components/MiniMap';

const event:EventDetail={id:'test',name:'Beéle',date:'2026-12-11T03:00:00Z',category:'CONCIERTO',coverImageUrl:null,description:null,venue:{id:'v',name:'Cuscatlán',city:'San Salvador',imageUrl:null,zones:[{id:'z',name:'Platinum',color:'#70c8d7',price:95},{id:'g',name:'Tribuna Sur',color:'#3697cc',price:35,generalAdmission:true,capacity:4000}],layout:{concert:{kind:'beele',demo:true},admission:{mode:'mixed',crowdUrl:'/models/beele-crowd.json'},field:{width:68,depth:107},corner:.84,seatPitch:1,aisleAngle:.01,stands:['E','N','O','S'],levels:[{name:'Nivel 1',rows:40,rowDepth:.78,rowRise:.46,baseHeight:1.4,baseOffset:1}]}}};
const payload:EventSeatsPayload={eventId:'test',count:4,ids:['s0','s1','s2','ga'],seatIds:['p0','p1','p2','pg'],zoneIdx:[0,0,0,1],rows:['M001','M001','M002','GA'],numbers:[1,2,1,12345],positions:[0,.7,0,0,.7,1,1,.7,0,0,0,0],rotations:[0,0,0,0],status:[0,0,2,0],lockedBy:{},zones:event.venue.zones,viewPct:[50,60,70,0],viewRange:{dMin:0,dMax:100}};
beforeEach(()=>useSeatsStore.getState().load('test',payload));
afterEach(()=>{cleanup();useSeatsStore.getState().reset();});

describe('interfaz compartida de vista previa',()=>{
  it('la silla muestra mesa, precio y navegación sin reservar al moverse',()=>{
    const reserve=vi.fn(),move=vi.fn(),exit=vi.fn();
    render(<SeatCard event={event} idx={0} busy={false} onReserve={reserve} onRelease={vi.fn()} onMove={move} onExit={exit}/>);
    expect(screen.getByLabelText('Vista previa de la localidad')).toBeInTheDocument();
    expect(screen.getByText('Mesa')).toBeInTheDocument();expect(screen.getByText('$95')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Al lado ▶'}));expect(move).toHaveBeenCalledWith(1);expect(reserve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Apartar este asiento'}));expect(reserve).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole('button',{name:'Volver a la vista general'}));expect(exit).toHaveBeenCalled();
    act(()=>useSeatsStore.getState().select(0,300));expect(screen.getByRole('button',{name:'Quitar de mi reserva'})).toBeInTheDocument();
  });
  it('mantiene el bloqueo de una silla vendida',()=>{
    render(<SeatCard event={event} idx={2} busy={false} onReserve={vi.fn()} onRelease={vi.fn()} onMove={vi.fn()} onExit={vi.fn()}/>);
    expect(screen.getByRole('button',{name:'Apartar este asiento'})).toBeDisabled();
  });
  it('las zonas usan la misma tarjeta sin inventar fila o asiento',()=>{
    const reserve=vi.fn();
    render(<ZonePreviewCard event={event} zone={1} position={{position:[-60,8,40],rotY:0}} points={[]} quantity={2} onQuantity={vi.fn()} available={4000} busy={false} onReserve={reserve} onMove={vi.fn()} onExit={vi.fn()}/>);
    expect(screen.getByLabelText('Vista previa de la localidad')).toBeInTheDocument();
    expect(screen.getByText('Sin asiento asignado')).toBeInTheDocument();expect(screen.queryByText('12345')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Apartar 2 entradas'}));expect(reserve).toHaveBeenCalledOnce();
    expect(screen.getByRole('button',{name:'Volver a la vista general'})).toBeInTheDocument();
  });
  it('el carrito común no ofrece un asiento ficticio para acceso por zona',()=>{
    useSeatsStore.getState().select(3,300);
    render(<ReservationCard onRelease={vi.fn()} onCheckout={vi.fn()} onGoTo={vi.fn()}/>);
    expect(screen.getByText('1 entrada apartada')).toBeInTheDocument();expect(screen.queryByText(/12345/)).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Pagar ahora'})).toBeInTheDocument();
  });
  it('el minimapa está visible de inicio y representa el escenario del concierto',()=>{
    render(<MiniMap layout={event.venue.layout} zones={event.venue.zones} camera={{x:0,z:0}} focus={{x:-20,z:5}}/>);
    expect(screen.getByLabelText('Minimapa del evento')).toBeVisible();
    expect(screen.getByRole('img',{name:'Mapa del concierto con escenario y posición de la cámara'})).toBeInTheDocument();
    expect(screen.getByText('Escenario',{selector:'title'})).toBeInTheDocument();
  });
});
