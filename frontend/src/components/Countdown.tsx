import { useEffect, useState } from 'react';

/** Cuenta regresiva a partir de un TTL en segundos recibido del servidor (issue #8). */
export function Countdown({ seconds, onExpire }: { seconds: number; onExpire?: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => setLeft(seconds), [seconds]);
  useEffect(() => {
    if (left <= 0) { onExpire?.(); return; }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left, onExpire]);
  const m = Math.floor(Math.max(0, left) / 60), s = Math.max(0, left) % 60;
  return <div className={`countdown ${left <= 30 ? 'critical' : left <= 60 ? 'warn' : ''}`} aria-live="polite">{m}:{s.toString().padStart(2, '0')}</div>;
}
