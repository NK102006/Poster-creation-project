import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import DoctorDetailsPage from './pages/DoctorDetailsPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

function getRoute() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/admin') return 'admin';

  const view = new URLSearchParams(window.location.search).get('view');
  if (view === 'admin' || view === 'doctor' || view === 'login') return view;
  return 'login';
}

function goTo(route) {
  if (route === 'admin') {
    window.history.pushState({}, '', '/admin');
    return;
  }

  const nextUrl = new URL(window.location.origin + '/');
  nextUrl.searchParams.set('view', route);
  window.history.pushState({}, '', nextUrl);
}

const DEMO_USER = { id: '12345', empid: '12345', name: 'UI User' };

function readStoredUser() {
  try {
    const stored = localStorage.getItem('auth_session');
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.warn('Could not read session:', err);
  }
  return null;
}

export default function App() {
  const [route, setRoute] = useState(getRoute);
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = readStoredUser();
    if (stored) return stored;
    if (getRoute() === 'doctor') return DEMO_USER;
    return null;
  });

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('auth_session', JSON.stringify(user));
    } catch (e) {}
    setRoute('doctor');
    goTo('doctor');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('auth_session');
    } catch (e) {}
    setRoute('login');
    goTo('login');
  };

  useEffect(() => {
    const syncFromUrl = () => {
      const next = getRoute();
      setRoute(next);
      if (next === 'doctor') {
        setCurrentUser((prev) => prev || readStoredUser() || DEMO_USER);
      }
    };

    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  if (route === 'admin') {
    return <AdminPage onLogout={handleLogout} />;
  }

  if (route === 'doctor') {
    return (
      <DoctorDetailsPage
        user={currentUser || DEMO_USER}
        onLogout={handleLogout}
      />
    );
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
