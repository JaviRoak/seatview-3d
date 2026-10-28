/**
 * Cabecera de un evento. Si hay `coverImageUrl`, muestra la imagen (object-fit
 * cover, tamaño fijo por aspect-ratio, `onError` → respaldo). Si no, dibuja un
 * SVG procedural según la categoría con un degradado derivado del nombre del
 * evento (hash → matiz), estable y distinto por evento. Sin binarios.
 */
import { useState } from 'react';
import type { EventCategory } from '../api/types';
import { API_URL } from '../api/client';

export function hueFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `${API_URL}${url}` : url;
}

interface Props { name: string; category: EventCategory; coverImageUrl?: string | null; className?: string; compact?: boolean }

export function EventCover({ name, category, coverImageUrl, className = '', compact = false }: Props) {
  const [failed, setFailed] = useState(false);
  const src = resolveImageUrl(coverImageUrl);
  if (src && !failed) return <img className={`cover-img ${className}`} src={src} alt={`Imagen de ${name}`} loading="lazy" onError={() => setFailed(true)} />;
  const hue = hueFromName(name);
  const id = `g-${hue}-${category}`;
  const c1 = `hsl(${hue} 42% 28%)`, c2 = `hsl(${(hue + 40) % 360} 48% 16%)`, ink = `hsl(${hue} 60% 78% / 0.55)`;
  return (
    <svg className={`cover-svg ${className}`} viewBox="0 0 480 270" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Ilustración de ${name}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.15" r="0.7"><stop offset="0" stopColor="#ffffff" stopOpacity="0.22" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="480" height="270" fill={`url(#${id})`} />
      <rect width="480" height="270" fill={`url(#${id}-glow)`} />
      {category === 'FUTBOL' && <FootballArt ink={ink} compact={compact} />}
      {category === 'CONCIERTO' && <ConcertArt ink={ink} compact={compact} />}
      {category === 'OTRO' && <GeometricArt ink={ink} hue={hue} />}
    </svg>
  );
}

/** Estadio estilizado: anillo de gradas en perspectiva y campo con líneas. */
function FootballArt({ ink, compact }: { ink: string; compact: boolean }) {
  return (
    <g fill="none" stroke={ink} strokeWidth={compact ? 2.5 : 2}>
      <ellipse cx="240" cy="178" rx="215" ry="82" strokeOpacity="0.5" />
      <ellipse cx="240" cy="172" rx="185" ry="68" strokeOpacity="0.7" />
      <ellipse cx="240" cy="166" rx="155" ry="55" />
      <g fill={ink} fillOpacity="0.18" stroke="none"><ellipse cx="240" cy="166" rx="155" ry="55" /></g>
      <rect x="130" y="138" width="220" height="60" rx="3" />
      <line x1="240" y1="138" x2="240" y2="198" />
      <circle cx="240" cy="168" r="14" />
      <rect x="130" y="153" width="28" height="30" /><rect x="322" y="153" width="28" height="30" />
      <path d="M120 158 h10 v20 h-10 M360 158 h-10 v20 h10" strokeWidth="3" />
      <g strokeOpacity="0.35"><path d="M60 95 Q240 20 420 95" /><path d="M45 120 Q240 40 435 120" /></g>
    </g>
  );
}

/** Orquesta: pentagrama ondulado, notas y un foco de escenario. */
function ConcertArt({ ink, compact }: { ink: string; compact: boolean }) {
  return (
    <g fill={ink} stroke={ink} strokeWidth={compact ? 2.5 : 2}>
      <g fill="none" strokeOpacity="0.5">
        {[0, 12, 24, 36, 48].map((o) => <path key={o} d={`M40 ${120 + o} C 140 ${95 + o}, 240 ${150 + o}, 440 ${118 + o}`} />)}
      </g>
      <g stroke="none">
        <ellipse cx="120" cy="153" rx="11" ry="8" transform="rotate(-20 120 153)" /><rect x="128" y="112" width="3" height="42" />
        <ellipse cx="215" cy="165" rx="11" ry="8" transform="rotate(-20 215 165)" /><rect x="223" y="124" width="3" height="42" /><path d="M226 124 q22 6 14 28 q6 -18 -14 -22z" />
        <ellipse cx="330" cy="140" rx="11" ry="8" transform="rotate(-20 330 140)" /><rect x="338" y="99" width="3" height="42" />
        <ellipse cx="390" cy="160" rx="11" ry="8" transform="rotate(-20 390 160)" /><rect x="398" y="119" width="3" height="42" />
      </g>
      <path d="M240 20 L150 250 L330 250 Z" fill={ink} fillOpacity="0.12" stroke="none" />
    </g>
  );
}

/** Geométrico: retícula de rombos con desplazamiento derivado del matiz. */
function GeometricArt({ ink, hue }: { ink: string; hue: number }) {
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    const s = 22 + ((hue + r * 7 + c * 13) % 18);
    cells.push(<rect key={`${r}-${c}`} x={30 + c * 60} y={30 + r * 60} width={s} height={s} rx="4" transform={`rotate(45 ${30 + c * 60 + s / 2} ${30 + r * 60 + s / 2})`} fill={ink} fillOpacity={0.1 + ((r + c) % 3) * 0.08} />);
  }
  return <g>{cells}</g>;
}
