import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import DoctorDetailsPage from './pages/DoctorDetailsPage.jsx';

const STORAGE_KEY = 'medportal-current-user';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [screen, setScreen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ? 'doctor' : 'login';
    } catch {
      return 'login';
    }
  });

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
        setScreen('doctor');
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setScreen('login');
      }
    } catch {
      // Ignore storage failures in private mode or restricted browsers.
    }
  }, [currentUser]);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  if (screen === 'doctor' && currentUser) {
    return <DoctorDetailsPage user={currentUser} onLogout={handleLogout} />;
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
