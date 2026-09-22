import { useEffect, useState } from 'react';
import MedicalAtmosphere from './components/MedicalAtmosphere.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DoctorHubPage from './pages/DoctorHubPage.jsx';
import DoctorDetailsPage from './pages/DoctorDetailsPage.jsx';
import ExistingDoctorsPage from './pages/ExistingDoctorsPage.jsx';
import DoctorManagePage from './pages/DoctorManagePage.jsx';
import AdminPortal from './pages/AdminPortal.jsx';

const VIEW_STATE_KEY = 'app_view_state';
const ALLOWED_VIEWS = new Set(['hub', 'new', 'existing', 'manage', 'admin']);

function readSavedViewState() {
  try {
    return JSON.parse(sessionStorage.getItem(VIEW_STATE_KEY) || 'null');
  } catch (err) {
    return null;
  }
}

function writeSavedViewState(view, doctorId) {
  try {
    if (view === 'login' || view === 'admin') return;
    sessionStorage.setItem(
      VIEW_STATE_KEY,
      JSON.stringify({ view, doctorId: doctorId || null })
    );
  } catch (err) {}
}

function clearSavedViewState() {
  try {
    sessionStorage.removeItem(VIEW_STATE_KEY);
  } catch (err) {}
}

function isAdminPath() {
  return window.location.pathname === '/admin';
}

function setAppView(view, { doctorId, replace = false } = {}) {
  const nextUrl = new URL(window.location.href);
  if (view === 'admin') {
    nextUrl.pathname = '/admin';
    nextUrl.search = '';
  } else {
    if (nextUrl.pathname === '/admin') nextUrl.pathname = '/';
    nextUrl.searchParams.set('view', view);
    if (doctorId) nextUrl.searchParams.set('doctorId', doctorId);
    else nextUrl.searchParams.delete('doctorId');
  }

  const state = { view, doctorId: doctorId || null };
  if (replace) window.history.replaceState(state, '', nextUrl);
  else window.history.pushState(state, '', nextUrl);
}

/** App state is the source of truth — never adopt a manually edited URL. */
function resolveAuthenticatedView() {
  if (isAdminPath()) {
    return { view: 'admin', doctorId: null };
  }

  const saved = readSavedViewState();
  let view = saved?.view;
  let doctorId = saved?.doctorId || null;

  if (!ALLOWED_VIEWS.has(view) || view === 'admin') {
    view = 'hub';
    doctorId = null;
  }

  if (view === 'manage' && !doctorId) {
    view = 'existing';
    doctorId = null;
  }

  writeSavedViewState(view, doctorId);
  setAppView(view, { doctorId, replace: true });
  return { view, doctorId };
}

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

  const initialAuthView = currentUser ? resolveAuthenticatedView() : null;

  const [view, setView] = useState(() => {
    if (isAdminPath()) return 'admin';
    return initialAuthView?.view || 'login';
  });
  const [doctorId, setDoctorId] = useState(() => initialAuthView?.doctorId || null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [startAtDesign, setStartAtDesign] = useState(false);

  const restoreAppState = (historyState) => {
    try {
      const stored = localStorage.getItem('auth_session');
      if (!stored) {
        setCurrentUser(null);
        setView(isAdminPath() ? 'admin' : 'login');
        setDoctorId(null);
        return;
      }
      setCurrentUser(JSON.parse(stored));
    } catch (err) {}

    if (isAdminPath()) {
      setView('admin');
      setDoctorId(null);
      return;
    }

    const candidate =
      historyState?.view && ALLOWED_VIEWS.has(historyState.view)
        ? historyState
        : readSavedViewState();

    let nextView = candidate?.view;
    let nextDoctorId = candidate?.doctorId || null;

    if (!ALLOWED_VIEWS.has(nextView) || nextView === 'admin') {
      nextView = 'hub';
      nextDoctorId = null;
    }
    if (nextView === 'manage' && !nextDoctorId) {
      nextView = 'existing';
      nextDoctorId = null;
    }

    setView(nextView);
    setDoctorId(nextDoctorId);
    writeSavedViewState(nextView, nextDoctorId);
    setAppView(nextView, { doctorId: nextDoctorId, replace: true });
  };

  useEffect(() => {
    const onPopState = (event) => {
      restoreAppState(event.state);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (nextView, options = {}) => {
    const nextDoctorId =
      options.doctorId !== undefined ? options.doctorId : doctorId;
    setView(nextView);
    if (options.doctorId !== undefined) setDoctorId(options.doctorId);
    if (options.doctor !== undefined) setSelectedDoctor(options.doctor);
    if (options.startAtDesign !== undefined) setStartAtDesign(Boolean(options.startAtDesign));
    else if (nextView !== 'new') setStartAtDesign(false);
    writeSavedViewState(nextView, nextDoctorId);
    setAppView(nextView, { doctorId: options.doctorId });
  };

  const goToHub = () => {
    setSelectedDoctor(null);
    navigate('hub', { doctorId: null, doctor: null });
  };

  const goToNewDoctor = () => {
    setSelectedDoctor(null);
    setStartAtDesign(false);
    navigate('new', { doctorId: null, doctor: null, startAtDesign: false });
  };

  const handleLoginSuccess = (payload) => {
    const user = payload?.user || payload;
    setCurrentUser(user);
    try {
      localStorage.setItem('auth_session', JSON.stringify(user));
    } catch (e) {}
    goToHub();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedDoctor(null);
    setDoctorId(null);
    clearSavedViewState();
    try {
      localStorage.removeItem('auth_session');
    } catch (e) {}
    navigate('login');
  };

  let screen = null;

  if (view === 'admin') {
    screen = <AdminPortal />;
  } else if (!currentUser) {
    screen = <LoginPage onLoginSuccess={handleLoginSuccess} />;
  } else if (view === 'hub') {
    screen = (
      <DoctorHubPage
        user={currentUser}
        onLogout={handleLogout}
        onAddNew={goToNewDoctor}
        onAccessExisting={() => navigate('existing')}
      />
    );
  } else if (view === 'existing') {
    screen = (
      <ExistingDoctorsPage
        user={currentUser}
        onLogout={handleLogout}
        onBack={goToHub}
        onSelectDoctor={(doc) => {
          setSelectedDoctor(doc);
          navigate('manage', { doctorId: doc.id, doctor: doc });
        }}
      />
    );
  } else if (view === 'manage' && doctorId) {
    screen = (
      <DoctorManagePage
        user={currentUser}
        doctorId={doctorId}
        onLogout={handleLogout}
        onBack={() => navigate('existing')}
        onStartNew={goToNewDoctor}
        onContinue={(doc) => {
          setSelectedDoctor(doc);
          navigate('new', {
            doctorId: doc?.id || doctorId,
            doctor: doc,
            startAtDesign: true,
          });
        }}
      />
    );
  } else if (view === 'new') {
    screen = (
      <DoctorDetailsPage
        user={currentUser}
        onLogout={handleLogout}
        onBrandClick={goToHub}
        onOpenExisting={() => navigate('existing')}
        onStartNew={goToNewDoctor}
        onBack={
          doctorId
            ? () => navigate('manage', { doctorId, doctor: selectedDoctor })
            : goToHub
        }
        existingDoctor={selectedDoctor}
        doctorId={doctorId}
        initialStep={startAtDesign ? 2 : 1}
      />
    );
  } else {
    screen = (
      <DoctorHubPage
        user={currentUser}
        onLogout={handleLogout}
        onAddNew={goToNewDoctor}
        onAccessExisting={() => navigate('existing')}
      />
    );
  }

  return (
    <>
      <MedicalAtmosphere />
      {screen}
    </>
  );
}
