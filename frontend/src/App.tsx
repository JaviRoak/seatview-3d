import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { EventsPage } from './features/events/EventsPage';
import { VisorPage } from './features/events/VisorPage';
import { LoginPage } from './features/auth/LoginPage';

export default function App() {
  return (
    <BrowserRouter>
      <TopBar />
      <Routes>
        <Route path="/" element={<EventsPage />} />
        <Route path="/eventos/:eventId" element={<VisorPage />} />
        <Route path="/ingresar" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}
