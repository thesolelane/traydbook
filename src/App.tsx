import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Feed from './pages/Feed';
import Jobs from './pages/Jobs';
import Network from './pages/Network';
import Bids from './pages/Bids';
import Profile from './pages/Profile';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/network" element={<Network />} />
          <Route path="/bids" element={<Bids />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
