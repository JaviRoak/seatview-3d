import { describe, expect, it } from 'vitest'
import { defaultVenue, generateVenue } from './generateVenue'

describe('generateVenue', () => {
  it('genera filas x asientos por cada seccion', () => {
    const seats = generateVenue(defaultVenue)
    const expected = defaultVenue.sections.reduce((acc, s) => acc + s.rows * s.seatsPerRow, 0)
    expect(seats).toHaveLength(expected)
  })

  it('asigna identificadores unicos', () => {
    const seats = generateVenue(defaultVenue)
    expect(new Set(seats.map((s) => s.id)).size).toBe(seats.length)
  })

  it('las filas traseras quedan mas lejos y mas altas', () => {
    const seats = generateVenue(defaultVenue)
    const first = seats.find((s) => s.id === 'C-F1-A15')!
    const last = seats.find((s) => s.id === 'C-F20-A15')!
    const dist = (p: [number, number, number]) => Math.hypot(p[0], p[2])

    expect(dist(last.position)).toBeGreaterThan(dist(first.position))
    expect(last.position[1]).toBeGreaterThan(first.position[1])
  })
})
