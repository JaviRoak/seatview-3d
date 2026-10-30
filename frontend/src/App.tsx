import { BrowserRouter, Navigate, Route, Routes, useMatch } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { Footer } from './components/Footer';
import { EventsPage } from './features/events/EventsPage';
import { EventEntryPage } from './features/events/EventEntryPage';
import { LoginPage } from './features/auth/LoginPage';
import { CheckoutPage } from './features/checkout/CheckoutPage';
import { TicketsPage } from './features/tickets/TicketsPage';
import { AdminPage } from './features/admin/AdminPage';

/** La vista del recinto ocupa toda la pantalla: ahí no va el pie de página. */
function PageFooter() {
  return useMatch('/eventos/:eventId') ? null : <Footer />;
}

export default function App() {
  return (
    <BrowserRouter>
      <TopBar />
      <Routes>
        <Route path="/" element={<EventsPage />} />
        <Route path="/estadios/cuscatlan" element={<Navigate to="/" replace />} />
        <Route path="/eventos/:eventId" element={<EventEntryPage />} />
        <Route path="/eventos/:eventId/pago" element={<CheckoutPage />} />
        <Route path="/boletos" element={<TicketsPage />} />
        <Route path="/ingresar" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
      <PageFooter />
    </BrowserRouter>
  );
}
