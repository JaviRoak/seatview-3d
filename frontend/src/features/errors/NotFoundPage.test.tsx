import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  it('muestra un h1, enlaces útiles y marca la página como noindex', () => {
    render(
      <MemoryRouter initialEntries={['/no-existe']}>
        <Routes><Route path="*" element={<NotFoundPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver la cartelera' })).toHaveAttribute('href', '/');
    expect(document.title).toBe('Página no encontrada | SeatView 3D');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
  });
});
