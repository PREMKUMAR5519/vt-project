import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MatchProvider } from './context/MatchContext';
import Navbar from './components/Layout/Navbar';
import Landing from './pages/Landing';
import MatchPage from './pages/MatchPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <AuthProvider>
      <MatchProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/match" element={<MatchPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </MatchProvider>
    </AuthProvider>
  );
}
