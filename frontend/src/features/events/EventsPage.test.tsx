import { describe, it, expect } from 'vitest';
import { agendaOrder, groupByMonth, money, splitName } from './EventsPage';
import type { EventSummary } from '../../api/types';

const ev = (id: string, date: string, featured: boolean): EventSummary => ({
  id, name: id, description: null, date, category: 'CONCIERTO', coverImageUrl: null, featured,
  venue: { id: 'v', name: 'Estadio', city: 'San Salvador' }, totalSeats: 10, soldSeats: 0, minPrice: 35,
});

describe('agenda de la cartelera', () => {
  it('pone los destacados primero y el resto al final, cada grupo por fecha', () => {
    const order = agendaOrder([ev('sinfonico', '2026-12-03T20:00:00', false), ev('beele', '2026-12-10T21:00:00', true), ev('final', '2026-11-15T19:00:00', true)]);
    expect(order.map((e) => e.id)).toEqual(['final', 'beele', 'sinfonico']);
    const groups = groupByMonth(order);
    expect(groups.map((g) => g.items.map((e) => e.id))).toEqual([['final'], ['beele', 'sinfonico']]);
    expect(groups[1].label).toMatch(/diciembre/);
  });
  it('formatea precios y separa el subtítulo del nombre', () => {
    expect(money(67.5)).toBe('$67.50');
    expect(money(35)).toBe('$35');
    expect(splitName('Andrea Bocelli · Romanza World Tour')).toEqual({ title: 'Andrea Bocelli', subtitle: 'Romanza World Tour' });
  });
});
