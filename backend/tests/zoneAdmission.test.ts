import {beforeAll,afterAll,beforeEach,describe,it,expect,vi} from 'vitest';
import {prisma} from '../src/lib/prisma';
import {redis} from '../src/lib/redis';
import {reserveZone} from '../src/modules/locks/zone-reservation';
import {lockService,seatKey,userSetKey} from '../src/modules/locks/locks.service';
import {checkout} from '../src/modules/payments/payments.service';
import {listMyTickets} from '../src/modules/tickets/tickets.service';
import request from 'supertest';
import {createApp} from '../src/app';
import {signToken} from '../src/modules/auth/auth.service';
vi.mock('../src/modules/tickets/mail.service',()=>({sendTicketsEmail:vi.fn().mockResolvedValue({})}));
let venueId:string,eventId:string,zoneId:string,numberedId:string;let ids:string[]=[];
const suffix=Date.now().toString();
const users=[0,1].map(i=>({id:`zone-test-${suffix}-${i}`,email:`zone-test-${suffix}-${i}@example.test`,name:'Zone test',role:'USER' as const}));
async function cleanLocks(){if(!eventId)return;await redis.del(...ids.map(id=>seatKey(eventId,id)),...users.map(u=>userSetKey(eventId,u.id)));}
beforeAll(async()=>{
  await prisma.user.createMany({data:users.map(u=>({...u,passwordHash:'not-a-login'}))});
  const venue=await prisma.venue.create({data:{name:'Isolated zone test',city:'Test',layout:{field:{width:68.5,depth:107},levels:[]}}});venueId=venue.id;
  const zone=await prisma.zone.create({data:{venueId,name:'Sol',price:10,color:'#55cccc'}});zoneId=zone.id;
  const numbered=await prisma.zone.create({data:{venueId,name:'Platea',price:20,color:'#aaaaaa'}});numberedId=numbered.id;
  await prisma.seat.createMany({data:[0,1,2,3].map(i=>({venueId,zoneId:i===3?numberedId:zoneId,idx:i,row:i===3?'01':'GA',number:i+1,posX:50,posY:1,posZ:20,rotY:0}))});
  const event=await prisma.event.create({data:{venueId,name:'Zone test',date:new Date()}});eventId=event.id;
  const seats=await prisma.seat.findMany({where:{venueId},orderBy:{idx:'asc'}});
  for(const s of seats){const es=await prisma.eventSeat.create({data:{eventId,seatId:s.id,status:s.idx===2?'SOLD':'AVAILABLE'}});ids.push(es.id);}
});
beforeEach(cleanLocks);
afterAll(async()=>{await cleanLocks();await prisma.ticket.deleteMany({where:{eventSeat:{eventId}}});await prisma.eventSeat.deleteMany({where:{eventId}});await prisma.order.deleteMany({where:{eventId}});await prisma.venue.delete({where:{id:venueId}});await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});});
describe('cupos por zona',()=>{
  it('dos compradores por los últimos dos cupos: solo uno obtiene la cantidad completa',async()=>{
    const results=await Promise.allSettled(users.map(u=>reserveZone(eventId,zoneId,2,u.id)));
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const r=results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof reserveZone>>>;
    expect(new Set(r.value.locks.map(l=>l.eventSeatId)).size).toBe(2);
    expect(r.value.locks.some(l=>l.eventSeatId===ids[2])).toBe(false);
  });
  it('una cantidad imposible no consume cupos y las reservas expiran',async()=>{
    await expect(reserveZone(eventId,zoneId,3,users[0].id)).rejects.toMatchObject({code:'ZONE_FULL'});
    expect(await lockService.listForUser(eventId,users[0].id)).toEqual([]);
    const r=await reserveZone(eventId,zoneId,1,users[0].id);await redis.pexpire(seatKey(eventId,r.locks[0].eventSeatId),1);
    await new Promise(r=>setTimeout(r,10));expect((await reserveZone(eventId,zoneId,2,users[1].id)).locks).toHaveLength(2);
  });
  it('rechaza zonas ajenas, cantidad fraccionaria y numeradas',async()=>{
    await expect(reserveZone(eventId,'otra-zona',1,users[0].id)).rejects.toThrow();
    await expect(reserveZone(eventId,zoneId,1.5,users[0].id)).rejects.toThrow();
    await expect(reserveZone(eventId,numberedId,1,users[0].id)).rejects.toThrow();
  });
  it('paga una entrada por zona una sola vez y conserva su acceso sin asiento',async()=>{
    const r=await reserveZone(eventId,zoneId,1,users[0].id);
    const input={eventId,eventSeatIds:r.locks.map(l=>l.eventSeatId),card:{holder:'Zone test',number:'4242424242424242',expMonth:12,expYear:2030,cvc:'123'}};
    const result=await checkout(users[0],input,{charge:async()=>({ok:true,authCode:'TEST'})});expect(result.total).toBe(10);
    const tickets=await listMyTickets(users[0].id);expect(tickets).toHaveLength(1);expect(tickets[0].seat.row).toBe('GA');
    await expect(checkout(users[0],input,{charge:async()=>({ok:true})})).rejects.toMatchObject({code:'LOCK_LOST'});
  });
  it('protege la API y rechaza seleccionar un cupo GA por su identificador',async()=>{
    const app=createApp();
    const unauth=await request(app).post('/api/locks/zone').send({eventId,zoneId,quantity:1});expect(unauth.status).toBe(401);
    const headers={Authorization:`Bearer ${signToken(users[1])}`};
    const individual=await request(app).post('/api/locks').set(headers).send({eventId,eventSeatId:ids[1]});expect(individual.status).toBe(400);
    const batch=await request(app).post('/api/locks/zone').set(headers).send({eventId,zoneId,quantity:1});expect(batch.status).toBe(201);expect(batch.body.locks).toHaveLength(1);
    const released=await request(app).delete('/api/locks').set(headers).send({eventId,eventSeatId:batch.body.locks[0].eventSeatId});expect(released.body.released).toBe(true);
  });
});
