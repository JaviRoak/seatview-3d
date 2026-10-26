import { useState } from 'react';
import { COLORS } from '../scene/seatColors';

/** Botón "?" con popover que explica los estados de los asientos (Cambio 2). */
export function HelpPopover() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn-icon" aria-expanded={open} aria-label="Ayuda sobre los estados" onClick={() => setOpen((o) => !o)} title="¿Qué significan los colores?">?</button>
      {open && (
        <div className="card help-pop">
          <span className="eyebrow">Estados de los asientos</span>
          <div className="legend-item"><span className="legend-dot" style={{ background: '#8ea3bf' }} />Disponible: color suave de su zona</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: COLORS.lockedMine }} />Seleccionado por ti</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: COLORS.sold }} />Vendido</div>
          <p className="notice" style={{ margin: '0.5rem 0 0' }}>Haz clic en un asiento para sentarte en él; desde ahí puedes seleccionarlo.</p>
        </div>
      )}
    </div>
  );
}
