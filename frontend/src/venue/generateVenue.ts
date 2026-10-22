export interface SectionConfig {
  id: string
  /** Angulo central de la seccion en radianes (0 = frente al escenario) */
  centerAngle: number
  /** Apertura angular de la seccion en radianes */
  arc: number
  rows: number
  seatsPerRow: number
}

export interface VenueConfig {
  /** Radio de la primera fila respecto al centro del escenario */
  innerRadius: number
  rowDepth: number
  rowRise: number
  sections: SectionConfig[]
}

export interface Seat {
  id: string
  sectionId: string
  row: number
  number: number
  position: [number, number, number]
  /** Rotacion en Y para que el asiento mire al escenario */
  rotationY: number
}

/**
 * Genera las posiciones de todos los asientos del recinto.
 * Cada seccion es un sector de anillo; las filas se alejan y suben
 * para simular la pendiente de una grada.
 */
export function generateVenue(config: VenueConfig): Seat[] {
  const seats: Seat[] = []

  for (const section of config.sections) {
    for (let row = 0; row < section.rows; row++) {
      const radius = config.innerRadius + row * config.rowDepth
      const y = row * config.rowRise
      const step = section.seatsPerRow > 1 ? section.arc / (section.seatsPerRow - 1) : 0
      const start = section.centerAngle - section.arc / 2

      for (let n = 0; n < section.seatsPerRow; n++) {
        const angle = section.seatsPerRow > 1 ? start + n * step : section.centerAngle
        const x = Math.sin(angle) * radius
        const z = Math.cos(angle) * radius

        seats.push({
          id: `${section.id}-F${row + 1}-A${n + 1}`,
          sectionId: section.id,
          row: row + 1,
          number: n + 1,
          position: [x, y, z],
          rotationY: angle + Math.PI,
        })
      }
    }
  }

  return seats
}

const deg = (d: number) => (d * Math.PI) / 180

/** Recinto de ejemplo en forma de herradura frente al escenario */
export const defaultVenue: VenueConfig = {
  innerRadius: 18,
  rowDepth: 1.1,
  rowRise: 0.45,
  sections: [
    { id: 'A', centerAngle: deg(-70), arc: deg(32), rows: 20, seatsPerRow: 30 },
    { id: 'B', centerAngle: deg(-35), arc: deg(32), rows: 20, seatsPerRow: 30 },
    { id: 'C', centerAngle: deg(0), arc: deg(32), rows: 20, seatsPerRow: 30 },
    { id: 'D', centerAngle: deg(35), arc: deg(32), rows: 20, seatsPerRow: 30 },
    { id: 'E', centerAngle: deg(70), arc: deg(32), rows: 20, seatsPerRow: 30 },
  ],
}
