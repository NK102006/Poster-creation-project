import { useEffect, useState } from 'react';
import MedicalAtmosphere from './components/MedicalAtmosphere.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DoctorHubPage from './pages/DoctorHubPage.jsx';
import DoctorDetailsPage from './pages/DoctorDetailsPage.jsx';
import ExistingDoctorsPage from './pages/ExistingDoctorsPage.jsx';
import DoctorManagePage from './pages/DoctorManagePage.jsx';
import AdminPortal from './pages/AdminPortal.jsx';
import SuperAdminPortal from './pages/SuperAdminPortal.jsx';
import UserPanel from './pages/UserPanel.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import { clearAuth, readAuth, writeAuth } from './lib/authSession.js';

const VIEW_STATE_KEY = 'app_view_state';
const STAFF_VIEWS = new Set(['admin', 'superadmin', 'userpanel']);
const ALLOWED_VIEWS = new Set(['hub', 'new', 'existing', 'manage', ...STAFF_VIEWS]);

function readSavedViewState() {
  try {
    return JSON.parse(sessionStorage.getItem(VIEW_STATE_KEY) || 'null');
  } catch (err) {
    return null;
  }
}

function writeSavedViewState(view, doctorId) {
  try {
    if (view === 'login' || STAFF_VIEWS.has(view)) return;
    sessionStorage.setItem(
      VIEW_STATE_KEY,
      JSON.stringify({ view, doctorId: doctorId || null })
    );
  } catch (err) { }
}

function clearSavedViewState() {
  try {
    sessionStorage.removeItem(VIEW_STATE_KEY);
  } catch (err) { }
}

function isAdminPath() {
  return window.location.pathname === '/admin';
}

function isSuperAdminPath() {
  return window.location.pathname === '/superadmin' || window.location.pathname === '/super-admin';
}

function isUserPanelPath() {
  return window.location.pathname === '/userpanel';
}

function isUnknownPath() {
  const p = window.location.pathname;
  return p !== '/' && p !== '/login' && !isAdminPath() && !isSuperAdminPath() && !isUserPanelPath();
}

function staffViewFromPath() {
  if (isSuperAdminPath()) return 'superadmin';
  if (isUserPanelPath()) return 'userpanel';
  if (isAdminPath()) return 'admin';
  return null;
}

function setAppView(view, { doctorId, replace = false } = {}) {
  const nextUrl = new URL(window.location.href);
  if (view === 'admin') {
    nextUrl.pathname = '/admin';
    nextUrl.search = '';
  } else if (view === 'superadmin') {
    nextUrl.pathname = '/superadmin';
    nextUrl.search = '';
  } else if (view === 'userpanel') {
    nextUrl.pathname = '/userpanel';
    nextUrl.search = '';
  } else if (view === 'notfound') {
    // leave the url alone
  } else {
    nextUrl.pathname = '/';
    if (view === 'login') {
      nextUrl.searchParams.delete('view');
    } else {
      nextUrl.searchParams.set('view', view);
    }
    if (doctorId) nextUrl.searchParams.set('doctorId', doctorId);
    else nextUrl.searchParams.delete('doctorId');
  }

  const state = { view, doctorId: doctorId || null };
  if (replace) window.history.replaceState(state, '', nextUrl);
  else window.history.pushState(state, '', nextUrl);
}

/** App state is the source of truth — never adopt a manually edited URL. */
function resolveAuthenticatedView() {
  const staffView = staffViewFromPath();
  if (staffView) {
    return { view: staffView, doctorId: null };
  }

  if (isUnknownPath()) {
    return { view: 'notfound', doctorId: null };
  }

  const saved = readSavedViewState();
  let view = saved?.view;
  let doctorId = saved?.doctorId || null;

  if (!ALLOWED_VIEWS.has(view) || STAFF_VIEWS.has(view)) {
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
    const stored = readAuth('portal');
    return stored?.role === 'user' ? stored : null;
  });

  const initialAuthView = currentUser ? resolveAuthenticatedView() : null;

  const [view, setView] = useState(() => {
    if (isUnknownPath()) return 'notfound';
    return staffViewFromPath() || initialAuthView?.view || 'login';
  });
  const [doctorId, setDoctorId] = useState(() => initialAuthView?.doctorId || null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [startAtDesign, setStartAtDesign] = useState(false);
  const [loginKey, setLoginKey] = useState(0);

  const restoreAppState = (historyState) => {
    const stored = readAuth('portal');
    if (!stored || stored.role !== 'user') {
      setCurrentUser(null);
      setView(isUnknownPath() ? 'notfound' : staffViewFromPath() || 'login');
      setDoctorId(null);
      return;
    }
    setCurrentUser(stored);

    const staffView = staffViewFromPath();
    if (staffView) {
      setView(staffView);
      setDoctorId(null);
      return;
    }

    const candidate =
      historyState?.view && ALLOWED_VIEWS.has(historyState.view)
        ? historyState
        : readSavedViewState();

    let nextView = candidate?.view;
    let nextDoctorId = candidate?.doctorId || null;

    if (!ALLOWED_VIEWS.has(nextView) || STAFF_VIEWS.has(nextView)) {
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
    const user = payload?.user || payload?.auth || payload;
    setCurrentUser(writeAuth(user, 'portal'));
    goToHub();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedDoctor(null);
    setDoctorId(null);
    clearSavedViewState();
    clearAuth('portal');
    setLoginKey((k) => k + 1);
    navigate('login');
  };

  let screen = null;

  if (view === 'notfound') {
    screen = <NotFoundPage onHome={() => { window.location.href = '/'; }} />;
  } else if (view === 'admin') {
    screen = <AdminPortal />;
  } else if (view === 'superadmin') {
    screen = <SuperAdminPortal />;
  } else if (view === 'userpanel') {
    screen = <UserPanel />;
  } else if (!currentUser) {
    screen = <LoginPage key={loginKey} onLoginSuccess={handleLoginSuccess} />;
  } else if (view === 'hub') {
    screen = (
      <DoctorHubPage
        user={currentUser}
        onLogout={handleLogout}
        onBrandClick={goToHub}
        onAddNew={goToNewDoctor}
        onAccessExisting={() => navigate('existing')}
      />
    );
  } else if (view === 'existing') {
    screen = (
      <ExistingDoctorsPage
        user={currentUser}
        onLogout={handleLogout}
        onBrandClick={goToHub}
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
        onBrandClick={goToHub}
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
