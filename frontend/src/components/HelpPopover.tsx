import { useState } from 'react';
import { COLORS } from '../scene/seatColors';

/** Botón "?" con popover que explica los estados de los asientos (Cambio 2). */
export function HelpPopover() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn-icon" aria-expanded={open} aria-label="Ayuda sobre los estados" onClick={() => setOpen((o) => !o)} title="Controles y colores">?</button>
      {open && (
        <div className="card help-pop">
          <strong>Controles</strong>
          <dl className="help-keys">
            <dt>Arrastrar</dt><dd>Mirar alrededor</dd>
            <dt>Rueda</dt><dd>Acercar o alejar</dd>
            <dt>Clic</dt><dd>Sentarte en ese lugar</dd>
          </dl>
          <span className="eyebrow">Colores</span>
          <div className="legend-item"><span className="legend-dot" style={{ background: '#8ea3bf' }} />Libre: color de su zona</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: COLORS.lockedMine }} />Tuyo</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: COLORS.lockedOther }} />En compra</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: COLORS.sold }} />Vendido</div>
          <p className="notice" style={{ margin: '0.5rem 0 0' }}>Sentarte en un lugar no lo aparta: usa "Apartar" en la tarjeta.</p>
        </div>
      )}
    </div>
  );
}
