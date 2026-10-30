/**
 * Cartel giratorio: el póster de cada evento destacado se reparte en paneles
 * verticales que giran en 3D (CSS) con un pequeño desfase entre ellos.
 * Avanza solo cada `autoplayMs`, se pausa con el cursor encima y acepta
 * arrastrar hacia los lados.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { EventSummary } from '../../api/types';
import { resolveImageUrl } from '../../components/EventCover';

const GAP = 3;

interface Props { events: EventSummary[]; index: number; onTurn: (next: number) => void; onHover: (hover: boolean) => void }

export function Billboard({ events, index, onTurn, onHover }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 520 });
  const dragX = useRef<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const n = events.length;
  if (!n) return <div ref={ref} className="billboard" />;
  const vanes = size.w < 960 ? 7 : 14;
  const w = (size.w - (vanes - 1) * GAP) / vanes;
  // Con un solo evento el prisma no gira: se usa un radio mínimo.
  const step = 360 / Math.max(n, 2), r = w / (2 * Math.tan(Math.PI / Math.max(n, 3)));
  return (
    <div ref={ref} className="billboard" onMouseEnter={() => onHover(true)} onMouseLeave={() => { onHover(false); dragX.current = null; }}
      onPointerDown={(e) => { dragX.current = e.clientX; }}
      onPointerUp={(e) => { if (dragX.current === null) return; const d = e.clientX - dragX.current; dragX.current = null; if (d < -40) onTurn(index + 1); else if (d > 40) onTurn(index - 1); }}>
      {Array.from({ length: vanes }, (_, k) => (
        <div key={k} className="billboard-vane" style={{ flexBasis: w, perspectiveOrigin: `${size.w / 2 - k * (w + GAP)}px 50%` }}>
          <div className="billboard-prism" style={{ transform: `translateZ(${-r}px) rotateY(${-index * step}deg)`, transitionDelay: `${k * 60}ms` }}>
            {events.map((ev, j) => {
              const src = resolveImageUrl(ev.coverImageUrl);
              const face: CSSProperties = { transform: `rotateY(${j * step}deg) translateZ(${r}px)` };
              const slice: CSSProperties = { left: -k * (w + GAP), width: size.w, height: size.h };
              return (
                <div key={ev.id} className="billboard-face" style={face}>
                  {src ? <img src={src} alt="" draggable={false} style={slice} /> : <span className="billboard-name" style={slice}>{ev.name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
