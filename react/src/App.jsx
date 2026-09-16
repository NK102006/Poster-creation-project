import { useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import DoctorDetailsPage from './pages/DoctorDetailsPage.jsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  if (currentUser) {
    return <DoctorDetailsPage user={currentUser} onLogout={handleLogout} />;
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
