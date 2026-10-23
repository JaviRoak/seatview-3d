/**
 * Estadio procedural (issue #5, Cambio 2). Geometría propia a partir del VenueLayout:
 *  - Gradas sólidas: por cada fila una plataforma (huella) y su contrahuella de concreto,
 *    fusionadas en UNA BufferGeometry por nivel (1 draw call por nivel).
 *  - Muro frontal de cada nivel, muros laterales en los pasillos entre tribunas,
 *    baranda a lo largo del borde delantero y muro trasero del último nivel.
 *  - Campo con franjas de césped alternadas, líneas, áreas, círculo central y porterías.
 *  - Cielo con degradado (esfera invertida con shader) y luces que dan volumen.
 * Sin texturas ni modelos externos.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { VenueLayout } from '../api/types';
import { arcTable, contourPoint, outerRadius, topHeight, FACADE_OFFSET } from './contour';

const STANDS = 4;
const SEAT_FLOOR_DROP = 0.45; // el piso de la fila está 45 cm bajo el punto del asiento (pedestal)

/** Acumulador de triángulos con normales planas. */
class Mesh3 {
  positions: number[] = []; normals: number[] = [];
  private push(p: THREE.Vector3, n: THREE.Vector3) { this.positions.push(p.x, p.y, p.z); this.normals.push(n.x, n.y, n.z); }
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-8) return; // quad degenerado (puntos coincidentes): sin normal válida → triángulo negro. Se omite.
    n.normalize();
    this.push(a, n); this.push(b, n); this.push(c, n); this.push(a, n); this.push(c, n); this.push(d, n);
  }
  /** Caja alineada a los ejes locales dada por 8 vértices (para muros y barandas). */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    this.quad(V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)); // top
    this.quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y0, z0), V(x0, y0, z0)); // bottom
    this.quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0));
    this.quad(V(x1, y0, z1), V(x0, y0, z1), V(x0, y1, z1), V(x1, y1, z1));
    this.quad(V(x0, y0, z1), V(x0, y0, z0), V(x0, y1, z0), V(x0, y1, z1));
    this.quad(V(x1, y0, z0), V(x1, y0, z1), V(x1, y1, z1), V(x1, y1, z0));
  }
  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    return g;
  }
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Un nivel completo: escalones de concreto, muro frontal, muros laterales, baranda y (último nivel) muro trasero. */
export function buildTier(layout: VenueLayout, levelIdx: number): { steps: THREE.BufferGeometry; walls: THREE.BufferGeometry; rails: THREE.BufferGeometry; boxes: THREE.BufferGeometry } {
  const lvl = layout.levels[levelIdx];
  const isLast = levelIdx === layout.levels.length - 1;
  const prev = levelIdx > 0 ? layout.levels[levelIdx - 1] : null;
  const steps = new Mesh3(), walls = new Mesh3(), rails = new Mesh3(), boxes = new Mesh3();
  const span = (Math.PI * 2) / STANDS, segs = 64, step = lvl.rowDepth;
  const yFloor = (ri: number) => lvl.baseHeight + ri * lvl.rowRise - SEAT_FLOOR_DROP;
  const dFront = lvl.baseOffset - step * 0.55;
  const dBack = lvl.baseOffset + (lvl.rows - 1) * step + step * 0.45;
  // Base del nivel: el suelo, o (niveles superiores) la coronación de la última fila del nivel anterior.
  const yBase = prev ? prev.baseHeight + (prev.rows - 1) * prev.rowRise - SEAT_FLOOR_DROP + prev.rowRise : 0;

  for (let si = 0; si < STANDS; si++) {
    const c = si * span, t0 = c - span / 2 + layout.aisleAngle, t1 = c + span / 2 - layout.aisleAngle;
    // Segmentos uniformes en longitud de arco (no en t): misma corrección que en el generador de asientos.
    const arc = arcTable(layout, t0, t1, lvl.baseOffset);
    const at = (i: number) => arc.tAt(i / segs);
    // Escalones
    for (let ri = 0; ri < lvl.rows; ri++) {
      const dIn = lvl.baseOffset + ri * step - step * 0.55, dOut = dIn + step;
      const y = yFloor(ri), yNext = ri + 1 < lvl.rows ? yFloor(ri + 1) : y + lvl.rowRise;
      for (let s = 0; s < segs; s++) {
        const ia = contourPoint(layout, at(s), dIn), ib = contourPoint(layout, at(s + 1), dIn);
        const oa = contourPoint(layout, at(s), dOut), ob = contourPoint(layout, at(s + 1), dOut);
        steps.quad(V(ia.x, y, ia.z), V(oa.x, y, oa.z), V(ob.x, y, ob.z), V(ib.x, y, ib.z)); // huella
        steps.quad(V(oa.x, y, oa.z), V(oa.x, yNext, oa.z), V(ob.x, yNext, ob.z), V(ob.x, y, ob.z)); // contrahuella
      }
    }
    // Muro frontal (del suelo/base del nivel a la primera fila) y baranda encima
    const yTop = yFloor(0);
    for (let s = 0; s < segs; s++) {
      const a = contourPoint(layout, at(s), dFront), b = contourPoint(layout, at(s + 1), dFront);
      if (prev) {
        // Anillo de palcos entre niveles: pretil de concreto, banda de palcos (vidrio oscuro) y remate.
        const yParapet = yBase + 1.0, yGlassTop = yTop - 0.35;
        walls.quad(V(a.x, yParapet, a.z), V(a.x, yBase, a.z), V(b.x, yBase, b.z), V(b.x, yParapet, b.z));
        boxes.quad(V(a.x, yGlassTop, a.z), V(a.x, yParapet, a.z), V(b.x, yParapet, b.z), V(b.x, yGlassTop, b.z));
        walls.quad(V(a.x, yTop, a.z), V(a.x, yGlassTop, a.z), V(b.x, yGlassTop, b.z), V(b.x, yTop, b.z));
        if (s % 6 === 0) { const a2 = contourPoint(layout, at(s), dFront + 0.25); walls.box(Math.min(a.x, a2.x) - 0.12, Math.max(a.x, a2.x) + 0.12, yParapet, yGlassTop, Math.min(a.z, a2.z) - 0.12, Math.max(a.z, a2.z) + 0.12); }
      } else {
        walls.quad(V(a.x, yTop, a.z), V(a.x, yBase, a.z), V(b.x, yBase, b.z), V(b.x, yTop, b.z));
      }
      const a2 = contourPoint(layout, at(s), dFront + 0.12), b2 = contourPoint(layout, at(s + 1), dFront + 0.12);
      // baranda: tabla superior + postes cada 4 segmentos
      rails.quad(V(a.x, yTop + 1.05, a.z), V(b.x, yTop + 1.05, b.z), V(b2.x, yTop + 1.05, b2.z), V(a2.x, yTop + 1.05, a2.z));
      rails.quad(V(a2.x, yTop + 0.95, a2.z), V(b2.x, yTop + 0.95, b2.z), V(b.x, yTop + 0.95, b.z), V(a.x, yTop + 0.95, a.z));
      if (s % 4 === 0) rails.quad(V(a.x, yTop, a.z), V(a2.x, yTop, a2.z), V(a2.x, yTop + 1.0, a2.z), V(a.x, yTop + 1.0, a.z));
    }
    // Cierre trasero de la última fila de cada nivel (pretil) — la cara trasera de la grada la cierra la fachada/explanada.
    const yLast = yFloor(lvl.rows - 1) + lvl.rowRise;
    for (let s2 = 0; s2 < segs; s2++) {
      const a = contourPoint(layout, at(s2), dBack), b = contourPoint(layout, at(s2 + 1), dBack);
      walls.quad(V(a.x, yLast - lvl.rowRise, a.z), V(b.x, yLast - lvl.rowRise, b.z), V(b.x, yLast + (isLast ? 1.2 : 0.3), b.z), V(a.x, yLast + (isLast ? 1.2 : 0.3), a.z));
      walls.quad(V(a.x, yLast + (isLast ? 1.2 : 0.3), a.z), V(b.x, yLast + (isLast ? 1.2 : 0.3), b.z), V(b.x, yLast - lvl.rowRise, b.z), V(a.x, yLast - lvl.rowRise, a.z));
    }
  }
  return { steps: steps.toGeometry(), walls: walls.toGeometry(), rails: rails.toGeometry(), boxes: boxes.toGeometry() };
}


/**
 * Cerramiento del recinto (Problema 3), derivado de los mismos parámetros del layout:
 *  - fachada exterior continua (todo el perímetro, incluidas esquinas curvas) del suelo a
 *    por encima de la última fila, con franja de acceso, división horizontal entre niveles,
 *    pilastras verticales y vanos recesados;
 *  - tapa de la explanada trasera entre la última fila y la fachada (cierra la cara trasera);
 *  - torres de escalera en las cuatro esquinas (sustituyen a los paneles sueltos de los pasillos);
 *  - muro perimetral interior al borde del campo;
 *  - voladizo sobre las tribunas laterales, por encima de la última fila (no bloquea la vista ni el POV).
 * Todo fusionado en 4 mallas: concreto, acentos oscuros, vidrio de vanos y cubierta.
 */
export function buildEnclosure(layout: VenueLayout): { concrete: THREE.BufferGeometry; dark: THREE.BufferGeometry; glass: THREE.BufferGeometry; roof: THREE.BufferGeometry } {
  const concrete = new Mesh3(), dark = new Mesh3(), glass = new Mesh3(), roof = new Mesh3();
  const last = layout.levels[layout.levels.length - 1], first = layout.levels[0];
  const dBack = last.baseOffset + (last.rows - 1) * last.rowDepth + last.rowDepth * 0.45;
  const dFacade = dBack + FACADE_OFFSET;
  const yTop = last.baseHeight + (last.rows - 1) * last.rowRise - SEAT_FLOOR_DROP + last.rowRise; // coronación última fila
  const yFacade = yTop + 3.4;
  const l2 = layout.levels[1] ?? first;
  const yDivision = l2.baseHeight - SEAT_FLOOR_DROP - 0.2; // división horizontal entre niveles
  const SEG = 48; // segmentos por cuadrante
  const span = Math.PI / 2;

  // Perímetro completo, uniforme en arco por cuadrante (incluye las esquinas: la fachada es continua).
  const ring = (d: number): THREE.Vector2[] => {
    const pts: THREE.Vector2[] = [];
    for (let q = 0; q < 4; q++) {
      const t0 = q * span - span / 2, t1 = t0 + span;
      const arc = arcTable(layout, t0, t1, d);
      for (let i = 0; i < SEG; i++) { const p = contourPoint(layout, arc.tAt(i / SEG), d); pts.push(new THREE.Vector2(p.x, p.z)); }
    }
    return pts;
  };
  const outer = ring(dFacade), outerPil = ring(dFacade + 0.45), inner = ring(dBack + 0.2), recess = ring(dFacade - 0.12);
  const N = outer.length;
  const wrap = (i: number) => (i + N) % N;
  const isAisle = (i: number) => { const q = i % SEG; return q < 3 || q >= SEG - 3; }; // segmentos junto a las esquinas → torres

  for (let i = 0; i < N; i++) {
    const a = outer[i], b = outer[wrap(i + 1)];
    // Piel exterior: franja de acceso (0–3.2 m, oscura, recesada), muro (3.2–yDivision), banda de división, muro superior.
    const ra = recess[i], rb = recess[wrap(i + 1)];
    dark.quad(V(ra.x, 0, ra.y), V(rb.x, 0, rb.y), V(rb.x, 3.2, rb.y), V(ra.x, 3.2, ra.y));
    concrete.quad(V(a.x, 3.2, a.y), V(b.x, 3.2, b.y), V(b.x, yDivision, b.y), V(a.x, yDivision, a.y));
    const pa = outerPil[i], pb = outerPil[wrap(i + 1)];
    concrete.quad(V(pa.x, yDivision, pa.y), V(pb.x, yDivision, pb.y), V(pb.x, yDivision + 0.6, pb.y), V(pa.x, yDivision + 0.6, pa.y)); // cornisa
    concrete.quad(V(a.x, yDivision, a.y), V(pa.x, yDivision, pa.y), V(pb.x, yDivision, pb.y), V(b.x, yDivision, b.y)); // cara inferior cornisa
    concrete.quad(V(a.x, yDivision + 0.6, a.y), V(b.x, yDivision + 0.6, b.y), V(b.x, yFacade, b.y), V(a.x, yFacade, a.y));
    // Vanos verticales recesados (vidrio oscuro) entre pilastras, en el cuerpo superior.
    if (i % 4 !== 0 && !isAisle(i)) glass.quad(V(ra.x, yDivision + 1.4, ra.y), V(rb.x, yDivision + 1.4, rb.y), V(rb.x, yFacade - 1.2, rb.y), V(ra.x, yFacade - 1.2, ra.y));
    // Pilastras cada 4 segmentos: caja entre la piel y +0.45 m.
    if (i % 4 === 0) {
      const c = outer[wrap(i + 1)], pc = outerPil[wrap(i + 1)];
      concrete.quad(V(pa.x, 0, pa.y), V(pc.x, 0, pc.y), V(pc.x, yFacade + 0.4, pc.y), V(pa.x, yFacade + 0.4, pa.y)); // frente
      concrete.quad(V(a.x, 0, a.y), V(pa.x, 0, pa.y), V(pa.x, yFacade + 0.4, pa.y), V(a.x, yFacade + 0.4, a.y)); // lado
      concrete.quad(V(pc.x, 0, pc.y), V(c.x, 0, c.y), V(c.x, yFacade + 0.4, c.y), V(pc.x, yFacade + 0.4, pc.y)); // lado
      concrete.quad(V(a.x, yFacade + 0.4, a.y), V(pa.x, yFacade + 0.4, pa.y), V(pc.x, yFacade + 0.4, pc.y), V(c.x, yFacade + 0.4, c.y)); // tapa
    }
    // Remate superior de la fachada y tapa de la explanada trasera (cierra por arriba el hueco bajo la grada).
    const ia = inner[i], ib = inner[wrap(i + 1)];
    concrete.quad(V(a.x, yFacade, a.y), V(b.x, yFacade, b.y), V(ib.x, yFacade, ib.y), V(ia.x, yFacade, ia.y));
    // Cara interior de la fachada (visible desde las gradas mirando atrás) y pared interior de la explanada.
    concrete.quad(V(b.x, yTop - 0.5, b.y), V(a.x, yTop - 0.5, a.y), V(a.x, yFacade, a.y), V(b.x, yFacade, b.y));
    concrete.quad(V(ib.x, yTop + 1.2, ib.y), V(ia.x, yTop + 1.2, ia.y), V(ia.x, yFacade, ia.y), V(ib.x, yFacade, ib.y));
  }

  // Torres de escalera en las esquinas: sector cerrado entre tribunas, del suelo a yFacade + 1.
  for (let q = 0; q < 4; q++) {
    const center = q * span + span / 2; // ángulo de la esquina entre la tribuna q y la q+1
    const t0 = center - layout.aisleAngle, t1 = center + layout.aisleAngle;
    const dIn = first.baseOffset - first.rowDepth * 0.55, dOut = dFacade + 0.45, h = yFacade + 1.0;
    const steps = 6;
    const innerPts: THREE.Vector2[] = [], outerPts: THREE.Vector2[] = [];
    for (let i = 0; i <= steps; i++) { const t = t0 + ((t1 - t0) * i) / steps; const pi = contourPoint(layout, t, dIn), po = contourPoint(layout, t, dOut); innerPts.push(new THREE.Vector2(pi.x, pi.z)); outerPts.push(new THREE.Vector2(po.x, po.z)); }
    for (let i = 0; i < steps; i++) {
      const ia = innerPts[i], ib = innerPts[i + 1], oa = outerPts[i], ob = outerPts[i + 1];
      concrete.quad(V(ib.x, 0, ib.y), V(ia.x, 0, ia.y), V(ia.x, h, ia.y), V(ib.x, h, ib.y)); // cara hacia el campo
      concrete.quad(V(oa.x, 0, oa.y), V(ob.x, 0, ob.y), V(ob.x, h, ob.y), V(oa.x, h, oa.y)); // cara exterior
      concrete.quad(V(ia.x, h, ia.y), V(oa.x, h, oa.y), V(ob.x, h, ob.y), V(ib.x, h, ib.y)); // tapa
      if (i % 2 === 0) glass.quad(V(ob.x, 3.2, ob.y), V(oa.x, 3.2, oa.y), V(oa.x, h - 1.5, oa.y), V(ob.x, h - 1.5, ob.y)); // vano vertical de la escalera
    }
    // Caras laterales (radiales) del sector, de doble cara para verse desde las gradas.
    for (const [pi, po] of [[innerPts[0], outerPts[0]], [innerPts[steps], outerPts[steps]]] as const) {
      concrete.quad(V(pi.x, 0, pi.y), V(po.x, 0, po.y), V(po.x, h, po.y), V(pi.x, h, pi.y));
      concrete.quad(V(po.x, 0, po.y), V(pi.x, 0, pi.y), V(pi.x, h, pi.y), V(po.x, h, po.y));
    }
  }

  // Muro perimetral interior al borde del campo (1,1 m), doble cara con remate.
  const wIn = ring(0.9), wOut = ring(1.25);
  for (let i = 0; i < wIn.length; i++) {
    const a = wIn[i], b = wIn[wrap(i + 1)], oa = wOut[i], ob = wOut[wrap(i + 1)];
    dark.quad(V(b.x, 0, b.y), V(a.x, 0, a.y), V(a.x, 1.1, a.y), V(b.x, 1.1, b.y));
    dark.quad(V(oa.x, 0, oa.y), V(ob.x, 0, ob.y), V(ob.x, 1.1, ob.y), V(oa.x, 1.1, oa.y));
    dark.quad(V(a.x, 1.1, a.y), V(oa.x, 1.1, oa.y), V(ob.x, 1.1, ob.y), V(b.x, 1.1, b.y));
  }

  // Voladizo sobre las tribunas laterales (Norte = q1, Sur = q3): losa inclinada desde la fachada
  // hasta 2 m por delante de la primera fila del nivel superior, 4,5 m por encima de la última fila.
  for (const q of [1, 3]) {
    const t0 = q * span - span / 2 + layout.aisleAngle, t1 = t0 + span - 2 * layout.aisleAngle;
    const dEdge = l2.baseOffset - 2.0;
    const arcO = arcTable(layout, t0, t1, dFacade + 0.45), arcI = arcTable(layout, t0, t1, dEdge);
    const yBack = yFacade + 0.4, yFront = yTop + 4.5;
    for (let i = 0; i < SEG; i++) {
      const oa = contourPoint(layout, arcO.tAt(i / SEG), dFacade + 0.45), ob = contourPoint(layout, arcO.tAt((i + 1) / SEG), dFacade + 0.45);
      const ia = contourPoint(layout, arcI.tAt(i / SEG), dEdge), ib = contourPoint(layout, arcI.tAt((i + 1) / SEG), dEdge);
      // losa (arriba y abajo) de 0,5 m
      roof.quad(V(oa.x, yBack + 0.5, oa.z), V(ob.x, yBack + 0.5, ob.z), V(ib.x, yFront + 0.5, ib.z), V(ia.x, yFront + 0.5, ia.z));
      roof.quad(V(ia.x, yFront, ia.z), V(ib.x, yFront, ib.z), V(ob.x, yBack, ob.z), V(oa.x, yBack, oa.z));
      roof.quad(V(ia.x, yFront, ia.z), V(ia.x, yFront + 0.5, ia.z), V(ib.x, yFront + 0.5, ib.z), V(ib.x, yFront, ib.z)); // canto frontal
      // pilares traseros cada 8 segmentos, de la fachada al voladizo
      if (i % 8 === 0) { const s = 0.35; concrete.box(oa.x - s, oa.x + s, yFacade + 0.4, yBack + 0.5, oa.z - s, oa.z + s); }
    }
  }
  return { concrete: concrete.toGeometry(), dark: dark.toGeometry(), glass: glass.toGeometry(), roof: roof.toGeometry() };
}

/** Campo: franjas de césped, líneas, áreas, círculo central, puntos penales y porterías. */
function Field({ w, d }: { w: number; d: number }) {
  const stripes = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);
  const lines = useMemo(() => {
    const pts: number[] = [];
    const L = (x1: number, z1: number, x2: number, z2: number) => pts.push(x1, 0.04, z1, x2, 0.04, z2);
    const hw = w / 2, hd = d / 2;
    L(-hw, -hd, hw, -hd); L(hw, -hd, hw, hd); L(hw, hd, -hw, hd); L(-hw, hd, -hw, -hd); L(0, -hd, 0, hd);
    const r = 9.15;
    for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2, b = ((i + 1) / 64) * Math.PI * 2; L(Math.cos(a) * r, Math.sin(a) * r, Math.cos(b) * r, Math.sin(b) * r); }
    for (const s of [-1, 1]) {
      // área grande 16.5 × 40.3 y área chica 5.5 × 18.3
      L(s * hw, -20.15, s * (hw - 16.5), -20.15); L(s * (hw - 16.5), -20.15, s * (hw - 16.5), 20.15); L(s * (hw - 16.5), 20.15, s * hw, 20.15);
      L(s * hw, -9.15, s * (hw - 5.5), -9.15); L(s * (hw - 5.5), -9.15, s * (hw - 5.5), 9.15); L(s * (hw - 5.5), 9.15, s * hw, 9.15);
      // arco del área
      for (let i = 0; i < 16; i++) {
        const a0 = -0.9 + (1.8 * i) / 16, a1 = -0.9 + (1.8 * (i + 1)) / 16;
        const cx = s * (hw - 11);
        L(cx - s * Math.cos(a0) * r, Math.sin(a0) * r, cx - s * Math.cos(a1) * r, Math.sin(a1) * r);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [w, d]);
  const hw = w / 2;
  return (
    <group>
      {/* césped base + franjas alternadas (segado en bandas) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[w + 8, d + 8]} /><meshStandardMaterial color="#2c7a45" roughness={1} /></mesh>
      {stripes.map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-hw + (w / 12) * (i + 0.5), 0.01, 0]}>
          <planeGeometry args={[w / 12, d]} /><meshStandardMaterial color={i % 2 === 0 ? '#348c50' : '#2f7f48'} roughness={1} />
        </mesh>
      ))}
      <lineSegments geometry={lines}><lineBasicMaterial color="#eef6ee" /></lineSegments>
      {[-1, 1].map((s) => <mesh key={`pen${s}`} position={[s * (hw - 11), 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.3, 12]} /><meshBasicMaterial color="#eef6ee" /></mesh>)}
      {/* porterías: postes, travesaño y red esquemática */}
      {[-1, 1].map((s) => (
        <group key={`goal${s}`} position={[s * hw, 0, 0]}>
          {[-3.66, 3.66].map((z) => <mesh key={z} position={[0, 1.22, z]}><cylinderGeometry args={[0.06, 0.06, 2.44, 8]} /><meshStandardMaterial color="#f4f4f4" /></mesh>)}
          <mesh position={[0, 2.44, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.06, 0.06, 7.44, 8]} /><meshStandardMaterial color="#f4f4f4" /></mesh>
          <mesh position={[s * 1.0, 1.22, 0]} rotation={[0, 0, 0]}><boxGeometry args={[2.0, 2.44, 7.32]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.12} depthWrite={false} /></mesh>
        </group>
      ))}
    </group>
  );
}

/** Cielo: esfera invertida con degradado vertical (shader propio, sin texturas). */
function Sky({ radius }: { radius: number }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#1a2c4d') }, horizon: { value: new THREE.Color('#2f4a74') }, bottom: { value: new THREE.Color('#0d1626') } },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vPos;
      void main(){ float h = normalize(vPos).y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.6)) : mix(horizon, bottom, pow(-h, 0.5)); gl_FragColor = vec4(c, 1.0); }`,
  }), []);
  return <mesh material={material}><sphereGeometry args={[radius, 24, 16]} /></mesh>;
}

/**
 * Marcador de ocupante sobre asientos apartados (previsto para una iteración
 * futura). Devuelve null: cuando se active, deberá renderizar una pieza pequeña
 * (InstancedMesh propia) en las posiciones de `seatIndices`.
 */
export const RENDER_OCCUPANT_MARKERS = false;
export function renderOccupantMarker(_seatIndices: number[]): JSX.Element | null {
  return null;
}

export function Stadium({ layout }: { layout: VenueLayout }) {
  const tiers = useMemo(() => layout.levels.map((_, i) => buildTier(layout, i)), [layout]);
  const enclosure = useMemo(() => buildEnclosure(layout), [layout]);
  const R = outerRadius(layout), H = topHeight(layout);
  const { width, depth } = layout.field;
  return (
    <group>
      <Sky radius={R * 4} />
      {/* explanada exterior */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}><circleGeometry args={[R * 2.2, 48]} /><meshStandardMaterial color="#1a2438" roughness={1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}><circleGeometry args={[R * 1.05, 48]} /><meshStandardMaterial color="#26324a" roughness={1} /></mesh>
      <Field w={width} d={depth} />
      {tiers.map((t, i) => (
        <group key={i}>
          <mesh geometry={t.steps} raycast={() => null}><meshStandardMaterial color={i % 2 === 0 ? '#6a7382' : '#5c6574'} roughness={0.92} metalness={0.02} /></mesh>
          <mesh geometry={t.walls} raycast={() => null}><meshStandardMaterial color="#3a4356" roughness={0.9} side={THREE.DoubleSide} /></mesh>
          <mesh geometry={t.rails} raycast={() => null}><meshStandardMaterial color="#c9ced8" roughness={0.5} metalness={0.4} /></mesh>
          {i > 0 && <mesh geometry={t.boxes} raycast={() => null}><meshStandardMaterial color="#5b7aa6" roughness={0.15} metalness={0.6} transparent opacity={0.75} /></mesh>}
        </group>
      ))}
      {/* Cerramiento: fachada, torres de esquina, muro interior y voladizo (4 mallas fusionadas) */}
      <mesh geometry={enclosure.concrete} raycast={() => null}><meshStandardMaterial color="#3b4354" roughness={0.92} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={enclosure.dark} raycast={() => null}><meshStandardMaterial color="#232a37" roughness={0.95} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={enclosure.glass} raycast={() => null}><meshStandardMaterial color="#4a5f83" roughness={0.2} metalness={0.5} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={enclosure.roof} raycast={() => null}><meshStandardMaterial color="#2c3543" roughness={0.8} side={THREE.DoubleSide} /></mesh>
      {/* torres de iluminación esquemáticas */}
      {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz], i) => (
        <group key={i} position={[sx * (R * 0.78), 0, sz * (R * 0.72)]}>
          <mesh position={[0, H * 1.1, 0]}><cylinderGeometry args={[0.35, 0.6, H * 2.2, 8]} /><meshStandardMaterial color="#3a4356" /></mesh>
          <mesh position={[0, H * 2.25, 0]}><boxGeometry args={[5, 1.6, 0.6]} /><meshStandardMaterial color="#e9eef7" emissive="#cfe0ff" emissiveIntensity={0.6} /></mesh>
        </group>
      ))}
      {RENDER_OCCUPANT_MARKERS && renderOccupantMarker([])}
    </group>
  );
}
