import { Link } from 'react-router-dom';
import { Icon } from './Icon';

/** Pie de página. Los enlaces sin página propia todavía apuntan a la cartelera. */
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="brand">SEATVIEW<span>3D</span></div>
          <p>Boletos con vista previa 3D. Mira la cancha desde tu asiento antes de pagar.</p>
          <div className="footer-social">
            <a href="#" title="Instagram" aria-label="Instagram"><Icon name="instagram" size={16} /></a>
            <a href="#" title="Facebook" aria-label="Facebook"><Icon name="facebook" size={16} /></a>
            <a href="#" title="X" aria-label="X"><Icon name="x" size={14} /></a>
          </div>
        </div>
        <nav aria-label="Eventos">
          <h6>Eventos</h6>
          <Link to="/?categoria=CONCIERTO">Conciertos</Link><Link to="/?categoria=FUTBOL">Deportes</Link><Link to="/">Recintos</Link>
        </nav>
        <nav aria-label="Ayuda">
          <h6>Ayuda</h6>
          <a href="#">Preguntas frecuentes</a><a href="#">Reembolsos</a><a href="#">Contacto</a>
        </nav>
        <nav aria-label="Organizadores">
          <h6>Organizadores</h6>
          <a href="#">Vender mis eventos</a><Link to="/admin">Panel de recintos</Link>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>© 2026 SeatView 3D · San Salvador, El Salvador</span>
        <span className="footer-secure"><Icon name="lock" size={14} />Pagos cifrados</span>
        <span className="footer-legal"><a href="#">Términos</a><a href="#">Privacidad</a><a href="#">Cookies</a></span>
      </div>
    </footer>
  );
}
