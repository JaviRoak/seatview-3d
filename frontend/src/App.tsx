import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { EventsPage } from './features/events/EventsPage';
import { VisorPage } from './features/events/VisorPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EventsPage />} />
        <Route path="/eventos/:eventId" element={<VisorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
