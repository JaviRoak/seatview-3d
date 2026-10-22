/**
 * Generación procedural del recinto (issues #5 y #11).
 *
 * Calcula las posiciones 3D de todos los asientos de un estadio. Geometría
 * propia: una superelipse (rectángulo redondeado) alrededor del campo dividida
 * en 4 tribunas angulares × N niveles; cada nivel es un anillo de filas
 * escalonadas que suben y se alejan del campo.
 *
 * El mismo `VenueLayout` (Venue.layout como JSON) lo usa el frontend para
 * dibujar el campo y las gradas; los asientos llegan por la API.
 * Coordenadas: X = ancho (largo del campo), Z = profundidad, Y = altura.
 */

export interface LevelSpec {
  name: string;
  rows: number;
  /** Separación radial entre filas (m) */
  rowDepth: number;
  /** Altura que sube cada fila (m) */
  rowRise: number;
  /** Altura del piso de la primera fila (m) */
  baseHeight: number;
  /** Distancia desde el borde del campo a la primera fila (m) */
  baseOffset: number;
}

export interface VenueModel { url: string; radius: number; height: number; seatingFootprint: { width: number; depth: number } }
export interface VenueLayout {
  concert?: { kind: 'beele' | 'bocelli'; demo: boolean };
  admission?: { mode: 'mixed'; crowdUrl: string };
  model?: VenueModel;
  field: { width: number; depth: number };
  /** Redondeo de esquinas, 0 = rectángulo, 1 = elipse */
  corner: number;
  /** Separación lateral entre asientos (m) */
  seatPitch: number;
  /** Pasillo entre tribunas (rad) */
  aisleAngle: number;
  levels: LevelSpec[];
  /** Nombres de las 4 tribunas en orden angular (Este, Norte, Oeste, Sur) */
  stands: string[];
}

export interface GeneratedSeat {
  idx: number;
  standIdx: number;
  levelIdx: number;
  row: string;
  number: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
}

/**
 * Layout por defecto calibrado para producir ≥ `target` asientos (8.000 por
 * defecto). Como las filas son enteras, se ajusta en pocas iteraciones y se
 * garantiza no quedar por debajo del objetivo.
 */
export function defaultLayout(target = 8000): VenueLayout {
  const make = (scale: number): VenueLayout => {
    const r = (n: number) => Math.max(2, Math.round(n * scale));
    return {
      field: { width: 105, depth: 68 },
      corner: 0.25,      // esquinas más rectas: la primera fila no invade el campo
      seatPitch: 0.8,
      aisleAngle: 0.2,   // esquinas abiertas (≈11° por lado): menos asientos por fila → más filas y más altura
      stands: ['Tribuna Este', 'Tribuna Norte', 'Tribuna Oeste', 'Tribuna Sur'],
      // Pendientes de estadio real: Nivel 1 ≈ 33° (0.55/0.85), Nivel 2 ≈ 39° (0.68/0.85).
      // Primera fila a 3,5 m del borde del campo (pasillo perimetral estrecho).
      levels: [
        { name: 'Nivel 1', rows: r(18), rowDepth: 0.85, rowRise: 0.55, baseHeight: 1.0, baseOffset: 3.5 },
        { name: 'Nivel 2', rows: r(14), rowDepth: 0.85, rowRise: 0.68, baseHeight: 0, baseOffset: 0 }, // se calcula debajo
      ],
    };
  };
  let scale = target / 23000;
  let layout = stack(make(scale));
  for (let i = 0; i < 6; i++) {
    const count = countSeats(layout);
    if (count >= target && count < target * 1.08) break;
    scale *= target / count;
    layout = stack(make(scale));
  }
  while (countSeats(layout) < target) {
    scale *= 1.05;
    layout = stack(make(scale));
  }
  return layout;
}

/** Anillo de palcos entre niveles (m): altura del muro/palcos que separa Nivel 1 de Nivel 2. */
export const BOX_RING_HEIGHT = 2.6;

/**
 * Coloca cada nivel encima del anterior: el Nivel 2 arranca justo detrás de la
 * última fila del Nivel 1 (más un pasillo) y por encima de un anillo de palcos,
 * para que el recinto se lea cerrado y alto en lugar de extendido.
 */
export function stack(layout: VenueLayout): VenueLayout {
  const levels = layout.levels.map((l) => ({ ...l }));
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1];
    const prevBackOffset = prev.baseOffset + (prev.rows - 1) * prev.rowDepth;
    const prevTop = prev.baseHeight + (prev.rows - 1) * prev.rowRise;
    levels[i].baseOffset = prevBackOffset + 1.6; // pasillo + frente de palcos
    levels[i].baseHeight = prevTop + BOX_RING_HEIGHT + 0.6;
  }
  return { ...layout, levels };
}

/** Punto sobre el contorno a distancia `d` del campo para el ángulo `t`. */
export function contourPoint(layout: VenueLayout, t: number, d: number): { x: number; z: number } {
  const a = layout.field.width / 2 + d;
  const b = layout.field.depth / 2 + d;
  const n = 2 + (1 - layout.corner) * 5; // 2 → elipse, ~7 → casi rectángulo
  const c = Math.cos(t);
  const s = Math.sin(t);
  return {
    x: Math.sign(c) * a * Math.pow(Math.abs(c), 2 / n),
    z: Math.sign(s) * b * Math.pow(Math.abs(s), 2 / n),
  };
}

/**
 * Tabla de longitud de arco entre t0 y t1 a distancia d. Necesaria porque el
 * parámetro t de la superelipse NO es proporcional a la distancia recorrida: en
 * el tramo recto del contorno un pequeño Δt equivale a metros enteros, y en las
 * esquinas a centímetros. Repartir asientos "uniformemente en t" producía huecos
 * de hasta 12 m en el centro de cada tribuna y superposiciones en los extremos.
 */
export function arcTable(layout: VenueLayout, t0: number, t1: number, d: number, steps = 1024): { length: number; tAt: (fraction: number) => number } {
  // Muestreo no uniforme: concentra puntos junto al eje central de la tribuna
  // (t = centro), donde la superelipse avanza metros por cada milésima de radián.
  const center = (t0 + t1) / 2, half = (t1 - t0) / 2;
  const warp = (u: number) => { const v = 2 * u - 1; return center + half * Math.sign(v) * Math.pow(Math.abs(v), 4); };
  const ts: number[] = [t0], cum: number[] = [0];
  let prev = contourPoint(layout, t0, d);
  for (let i = 1; i <= steps; i++) {
    const t = i === steps ? t1 : warp(i / steps);
    const p = contourPoint(layout, t, d);
    cum.push(cum[i - 1] + Math.hypot(p.x - prev.x, p.z - prev.z));
    ts.push(t);
    prev = p;
  }
  const length = cum[steps];
  const tAt = (fraction: number) => {
    const target = Math.max(0, Math.min(1, fraction)) * length;
    let lo = 0, hi = steps;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; }
    if (lo === 0) return ts[0];
    const seg = cum[lo] - cum[lo - 1];
    const f = seg > 0 ? (target - cum[lo - 1]) / seg : 0;
    return ts[lo - 1] + (ts[lo] - ts[lo - 1]) * f;
  };
  return { length, tAt };
}

function arcLength(layout: VenueLayout, t0: number, t1: number, d: number): number {
  return arcTable(layout, t0, t1, d, 64).length;
}

const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export function rowLabel(i: number): string {
  const first = ROW_LETTERS[i % ROW_LETTERS.length];
  const cycle = Math.floor(i / ROW_LETTERS.length);
  return cycle === 0 ? first : `${first}${cycle + 1}`;
}

/** Cuenta asientos sin materializarlos (misma fórmula que generateSeats). */
export function countSeats(layout: VenueLayout): number {
  const standSpan = (Math.PI * 2) / 4;
  let total = 0;
  for (const lvl of layout.levels) {
    for (let si = 0; si < 4; si++) {
      const center = si * standSpan;
      const t0 = center - standSpan / 2 + layout.aisleAngle;
      const t1 = center + standSpan / 2 - layout.aisleAngle;
      for (let ri = 0; ri < lvl.rows; ri++) {
        const d = lvl.baseOffset + ri * lvl.rowDepth;
        total += Math.max(1, Math.floor(arcTable(layout, t0, t1, d).length / layout.seatPitch));
      }
    }
  }
  return total;
}

/** Genera todos los asientos del recinto. Determinista. */
export function generateSeats(layout: VenueLayout): GeneratedSeat[] {
  const seats: GeneratedSeat[] = [];
  const standSpan = (Math.PI * 2) / 4;
  let idx = 0;
  for (let li = 0; li < layout.levels.length; li++) {
    const lvl = layout.levels[li];
    for (let si = 0; si < 4; si++) {
      const center = si * standSpan;
      const t0 = center - standSpan / 2 + layout.aisleAngle;
      const t1 = center + standSpan / 2 - layout.aisleAngle;
      for (let ri = 0; ri < lvl.rows; ri++) {
        const d = lvl.baseOffset + ri * lvl.rowDepth;
        const y = lvl.baseHeight + ri * lvl.rowRise;
        const arc = arcTable(layout, t0, t1, d);
        const count = Math.max(1, Math.floor(arc.length / layout.seatPitch));
        for (let n = 0; n < count; n++) {
          // Reparto uniforme en LONGITUD DE ARCO (no en t): separación constante = seatPitch.
          const p = contourPoint(layout, arc.tAt((n + 0.5) / count), d);
          seats.push({
            idx: idx++, standIdx: si, levelIdx: li, row: rowLabel(ri), number: n + 1,
            x: round3(p.x), y: round3(y), z: round3(p.z), rotY: round3(Math.atan2(-p.x, -p.z)),
          });
        }
      }
    }
  }
  return seats;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Zonas = tribuna × nivel. Paleta APAGADA y desaturada: una familia de color por
 * tribuna, más clara en Nivel 1 y más oscura en Nivel 2. Los colores saturados
 * quedan reservados a los estados (ámbar = tu reserva, gris = en compra por
 * otro, rojo oscuro = vendido) para que nunca compitan con las zonas.
 */
export const STAND_FAMILIES: Array<[string, string]> = [
  ['#8ea3bf', '#5b6d87'], // Este  · azul pizarra
  ['#9db59a', '#66805f'], // Norte · salvia
  ['#b39aa8', '#7d6473'], // Oeste · malva
  ['#c2b18f', '#8a7a5a'], // Sur   · arena
];

export function zoneSpecs(layout: VenueLayout) {
  const basePrices = [45, 25];
  const standMult = [1.5, 1.0, 1.5, 1.0];
  const out: Array<{ standIdx: number; levelIdx: number; name: string; color: string; price: number }> = [];
  for (let li = 0; li < layout.levels.length; li++) {
    for (let si = 0; si < 4; si++) {
      out.push({
        standIdx: si, levelIdx: li,
        name: `${layout.stands[si]} · ${layout.levels[li].name}`,
        color: STAND_FAMILIES[si][Math.min(li, 1)],
        price: Math.round((basePrices[li] ?? 20) * standMult[si] * 100) / 100,
      });
    }
  }
  return out;
}
