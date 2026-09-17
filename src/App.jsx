import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import DoctorDetailsPage from './pages/DoctorDetailsPage.jsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('auth_session');
      if (stored) return JSON.parse(stored);
    } catch (err) {
      console.warn('Could not read session:', err);
    }
    return null;
  });

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('auth_session', JSON.stringify(user));
    } catch (e) {}
    
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('view', 'doctor');
    window.history.pushState({}, '', nextUrl);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('auth_session');
    } catch (e) {}
    
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('view', 'login');
    window.history.pushState({}, '', nextUrl);
  };

  useEffect(() => {
    const handlePopState = () => {
      // On browser back/forward, sync with localStorage to keep session active if they didn't logout
      try {
        const stored = localStorage.getItem('auth_session');
        if (stored) {
          setCurrentUser(JSON.parse(stored));
        } else {
          setCurrentUser(null);
        }
      } catch (err) {}
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (currentUser) {
    return <DoctorDetailsPage user={currentUser} onLogout={handleLogout} />;
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
