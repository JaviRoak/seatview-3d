import {render,screen} from '@testing-library/react';
import {it,expect} from 'vitest';
import {TicketCard} from './TicketCard';
it('no imprime un asiento ficticio en el boleto por zona',()=>{
  render(<TicketCard eventName="Prueba" date="2026-10-15" venue="Cuscatlán" zone="Sol General" row="GA" number={12345} qrData="test"/>);
  expect(screen.getByText(/sin asiento asignado/)).toBeTruthy();
  expect(screen.queryByText(/Fila/)).toBeNull();expect(screen.queryByText(/12345/)).toBeNull();
});
it('en la confirmación muestra "Gral." en lugar del número interno del cupo',()=>{
  render(<TicketCard variant="full" eventName="Prueba" date="2026-10-15" venue="Cuscatlán" zone="Sol General" row="GA" number={12345} qrData="test"/>);
  expect(screen.getByText('Gral.')).toBeTruthy();expect(screen.queryByText(/12345/)).toBeNull();
});
