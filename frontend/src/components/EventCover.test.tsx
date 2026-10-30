import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EventCover, hueFromName, resolveImageUrl } from './EventCover';

describe('EventCover', () => {
  it('sin imagen renderiza un SVG procedural con matiz estable por nombre', () => {
    const { container } = render(<EventCover name="Final Nacional de Fútbol" category="FUTBOL" coverImageUrl={null} />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(hueFromName('Final Nacional de Fútbol')).toBe(hueFromName('Final Nacional de Fútbol'));
    expect(hueFromName('A')).not.toBe(hueFromName('B'));
  });
  it('con imagen renderiza <img> y resuelve URLs relativas contra la API', () => {
    const { container } = render(<EventCover name="X" category="OTRO" coverImageUrl="/uploads/abc.png" />);
    const img = container.querySelector('img')!;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe(resolveImageUrl('/uploads/abc.png'));
    expect(resolveImageUrl('https://cdn.x/y.png')).toBe('https://cdn.x/y.png');
    expect(resolveImageUrl('/models/cuscatlan-event.png')).toBe('/models/cuscatlan-event.png');
  });
});
