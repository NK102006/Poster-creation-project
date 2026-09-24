export default function NotFoundPage({ onHome }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fff', color: '#1a56db', fontFamily: 'Inter, sans-serif', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '480px',
        width: '100%',
      }}>
        <h1 style={{ fontSize: '120px', fontWeight: 800, margin: '0 0 8px', color: '#1a56db', lineHeight: 1 }}>
          404
        </h1>
        <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 16px', color: '#1a56db' }}>
          Page not found
        </h2>
        <p style={{ fontSize: '15px', color: '#3b73e8', margin: '0 0 36px', lineHeight: 1.6 }}>
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <button
          onClick={onHome}
          style={{
            background: '#1a56db',
            color: '#fff',
            border: 'none',
            padding: '12px 32px',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'transform 0.2s, background 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.background = '#1547b8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = '#1a56db'; }}
        >
          Return Home
        </button>
      </div>
    </div>
  );
}
