import { useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import DoctorDetailsPage from './pages/DoctorDetailsPage.jsx';

function getViewFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('view') === 'doctor' ? 'doctor' : 'login';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    return getViewFromUrl() === 'doctor' ? { id: 101 } : null;
  });

  const showDoctorView = currentUser || getViewFromUrl() === 'doctor';

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('view', 'doctor');
    window.history.replaceState({}, '', nextUrl);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('view', 'login');
    window.history.replaceState({}, '', nextUrl);
  };

  if (showDoctorView) {
    return <DoctorDetailsPage user={currentUser || { id: 101 }} onLogout={handleLogout} />;
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
