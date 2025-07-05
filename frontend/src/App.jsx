import { useState, useEffect } from 'react'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'
import duunaiLogo from './assets/duunai-logo.png'
import './App.css'

const GOOGLE_CLIENT_ID = '710465609392-i9pqanndqjehq5rejb9bt9j512gmsp3j.apps.googleusercontent.com'

// Icon SVGs
const EditIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none"><path d="M13.586 3.586a2 2 0 0 1 2.828 2.828l-8.25 8.25a2 2 0 0 1-.878.513l-3.25.93.93-3.25a2 2 0 0 1 .513-.878l8.25-8.25Z" stroke="#6366f1" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 6l3 3" stroke="#6366f1" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const DeleteIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none"><rect x="5" y="7" width="10" height="8" rx="2" stroke="#ff4d4f" strokeWidth="1.7"/><path d="M3 7h14" stroke="#ff4d4f" strokeWidth="1.7" strokeLinecap="round"/><path d="M8 7V5a2 2 0 0 1 4 0v2" stroke="#ff4d4f" strokeWidth="1.7"/></svg>
);
const SaveIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="#22c55e" strokeWidth="1.7"/><path d="M6 10.5l2.5 2.5L14 7.5" stroke="#22c55e" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const CancelIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="#888" strokeWidth="1.7"/><path d="M7 7l6 6M13 7l-6 6" stroke="#888" strokeWidth="1.7" strokeLinecap="round"/></svg>
);

function AppContent() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [todos, setTodos] = useState([])
  const [checked, setChecked] = useState([])
  const [editIdx, setEditIdx] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [user, setUser] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [genCount, setGenCount] = useState(0)
  const [limitReached, setLimitReached] = useState(false)
  const [showToast, setShowToast] = useState(false)

  // Helper: get today's date string
  const todayStr = () => new Date().toISOString().slice(0, 10)

  // Load generation count from localStorage on login
  useEffect(() => {
    if (user && user.email) {
      const key = `genCount_${user.email}_${todayStr()}`
      const count = parseInt(localStorage.getItem(key) || '0', 10)
      setGenCount(count)
      setLimitReached(count >= 3)
    }
  }, [user])

  // Save generation count to localStorage
  const incrementGenCount = () => {
    if (user && user.email) {
      const key = `genCount_${user.email}_${todayStr()}`
      const newCount = genCount + 1
      localStorage.setItem(key, newCount)
      setGenCount(newCount)
      setLimitReached(newCount >= 3)
    }
  }

  // Toast close handler
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleSend = async (e) => {
    e.preventDefault()
    if (!user) {
      setShowLogin(true)
      return
    }
    if (limitReached) {
      setError('You have reached your daily limit of 3 to-do generations.')
      return
    }
    if (!input.trim()) return
    setLoading(true)
    setError('')
    setTodos([])
    setChecked([])
    try {
      const response = await fetch('http://localhost:3001/extract-todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      })
      const data = await response.json()
      if (response.ok) {
        setTodos(data.todos)
        setChecked(Array(data.todos.length).fill(false))
        setInput('')
        incrementGenCount()
      } else {
        setError(data.error || 'Failed to extract to-dos.')
      }
    } catch (err) {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  const handleCheck = (idx) => {
    setChecked((prev) => prev.map((c, i) => (i === idx ? !c : c)))
  }

  const handleDelete = (idx) => {
    setTodos((prev) => prev.filter((_, i) => i !== idx))
    setChecked((prev) => prev.filter((_, i) => i !== idx))
    if (editIdx === idx) {
      setEditIdx(null)
      setEditValue('')
    }
  }

  const handleEdit = (idx) => {
    setEditIdx(idx)
    setEditValue(todos[idx])
  }

  const handleEditChange = (e) => {
    setEditValue(e.target.value)
  }

  const handleEditSave = (idx) => {
    setTodos((prev) => prev.map((item, i) => (i === idx ? editValue : item)))
    setEditIdx(null)
    setEditValue('')
  }

  const handleEditCancel = () => {
    setEditIdx(null)
    setEditValue('')
  }

  // Google login success handler
  const handleLoginSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential)
      setUser({
        credential: credentialResponse.credential,
        name: decoded.name,
        picture: decoded.picture,
        email: decoded.email,
      })
      setShowLogin(false)
    } catch (e) {
      setError('Failed to decode Google login.')
      setShowLogin(false)
    }
  }

  // Google login error handler
  const handleLoginError = () => {
    setError('Google login failed.')
    setShowLogin(false)
  }

  // Logout
  const handleLogout = () => {
    setUser(null)
    setGenCount(0)
    setLimitReached(false)
  }

  return (
    <div className="container">
      {/* Responsive header bar, now fixed at the top */}
      <header className="header-bar fixed-header">
        <div className="header-logo-centered">
          <img src={duunaiLogo} alt="Duunai Logo" className="logo-img" />
        </div>
        <div className="header-login">
          {user ? (
            <>
              <img src={user.picture} alt={user.name} title={user.name} className="user-avatar" />
              <button className="secondary-btn logout-btn" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <button className="secondary-btn login-btn" onClick={() => setShowLogin(true)}>Login</button>
          )}
      </div>
      </header>
      {/* Removed centered logo above heading */}
      <h1 className="main-heading">Welcome to Duunai</h1>
      <div className="slogan">Next-gen to-do list powered by AI</div>
      <div className="card">
        <form onSubmit={handleSend} style={{ width: '100%' }}>
          <div
            className="input-container"
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#23232a',
              borderRadius: 18,
              padding: '0.7em 1.2em',
              position: 'relative',
              width: '100%',
            }}
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Describe what you need to do..."
              disabled={loading}
              style={{ flex: 1, borderRadius: 14, border: 'none', background: 'transparent', color: '#f4f4f5', fontSize: '1.18rem', padding: '1.1em 0', outline: 'none', fontWeight: 500, letterSpacing: 0.1, transition: 'box-shadow 0.2s' }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{ background: '#23232a', border: 'none', borderRadius: '50%', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 12, padding: 0, cursor: loading || limitReached ? 'not-allowed' : 'pointer' }}
              onClick={e => {
                if (limitReached) {
                  e.preventDefault();
                  setShowToast(true);
                }
              }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="16" fill="#23232a" />
                <path d="M16 10V22" stroke="#A1A1AA" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M10 16L16 10L22 16" stroke="#A1A1AA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </form>
        {/* Google login popup */}
        {showLogin && !user && (
          <>
            {/* Backdrop for closing popup on click */}
            <div
              className="popup-backdrop"
              onClick={() => setShowLogin(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.32)',
                zIndex: 99,
              }}
            />
            {/* Popup itself */}
            <div style={{ marginTop: 32, zIndex: 100, background: '#23232a', borderRadius: 16, boxShadow: '0 2px 16px 0 rgba(0,0,0,0.18)', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'absolute', left: '50%', top: '20%', transform: 'translate(-50%, 0)', minWidth: 320 }}>
              {/* X button */}
              <button
                aria-label="Close"
                onClick={() => setShowLogin(false)}
                style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', zIndex: 101 }}
              >
                ×
              </button>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 22, marginBottom: 18, marginTop: 8 }}>Welcome to Duunai</div>
              <GoogleLogin
                onSuccess={handleLoginSuccess}
                onError={handleLoginError}
                useOneTap
              />
              <button style={{ marginTop: 16, background: 'transparent', color: '#fff', border: 'none', fontSize: 18, cursor: 'pointer' }} onClick={() => setShowLogin(false)}>Cancel</button>
            </div>
          </>
        )}
        {error && <div className="error" style={{ textAlign: 'center', marginTop: 12 }}>{error}</div>}
        {user && (
          <div style={{ color: '#aaa', fontSize: 15, marginTop: 10, marginBottom: 0, width: '100%', textAlign: 'right' }}>
            {`You have ${3 - genCount} to-do generations left today.`}
          </div>
        )}
        {todos.length > 0 && (
          <div style={{ marginTop: 32, width: '100%' }}>
            <h2 style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '1.3rem', marginBottom: 16 }}>Your To-Do List</h2>
            <ul style={{ listStyle: 'none', paddingLeft: 0, color: '#f4f4f5', fontSize: '1.1rem', margin: 0 }}>
              {todos.map((todo, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 16, background: 'transparent' }}>
                  <input
                    type="checkbox"
                    checked={checked[idx] || false}
                    onChange={() => handleCheck(idx)}
                    style={{ marginRight: 16, width: 22, height: 22, accentColor: '#6366f1', cursor: 'pointer' }}
                  />
                  {editIdx === idx ? (
                    <>
                      <input
                        type="text"
                        value={editValue}
                        onChange={handleEditChange}
                        style={{ flex: 1, marginRight: 8, fontSize: '1.1rem', borderRadius: 6, border: '1px solid #6366f1', padding: '0.3em 0.7em', background: '#18181b', color: '#f4f4f5' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          style={{ background: 'transparent', border: 'none', padding: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer', outline: 'none', transition: 'background 0.15s' }}
                          onClick={() => handleEditSave(idx)}
                          type="button"
                          aria-label="Save"
                          onMouseOver={e => e.currentTarget.style.background = '#1e293b22'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <SaveIcon />
                        </button>
                        <button
                          style={{ background: 'transparent', border: 'none', padding: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer', outline: 'none', transition: 'background 0.15s' }}
                          onClick={handleEditCancel}
                          type="button"
                          aria-label="Cancel"
                          onMouseOver={e => e.currentTarget.style.background = '#1e293b22'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <CancelIcon />
                        </button>
                        <button
                          style={{ background: 'transparent', border: 'none', padding: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer', outline: 'none', transition: 'background 0.15s' }}
                          onClick={() => handleDelete(idx)}
                          aria-label="Delete todo"
                          type="button"
                          onMouseOver={e => e.currentTarget.style.background = '#1e293b22'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, textDecoration: checked[idx] ? 'line-through' : 'none', color: checked[idx] ? '#888' : '#f4f4f5', fontSize: '1.1rem' }}>{todo}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          style={{ marginLeft: 0, background: 'transparent', border: 'none', padding: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer', outline: 'none', transition: 'background 0.15s' }}
                          onClick={() => handleEdit(idx)}
                          type="button"
                          aria-label="Edit"
                          onMouseOver={e => e.currentTarget.style.background = '#1e293b22'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <EditIcon />
                        </button>
                        <button
                          style={{ marginLeft: 0, background: 'transparent', border: 'none', padding: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer', outline: 'none', transition: 'background 0.15s' }}
                          onClick={() => handleDelete(idx)}
                          aria-label="Delete todo"
                          type="button"
                          onMouseOver={e => e.currentTarget.style.background = '#1e293b22'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <DeleteIcon />
        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Toast notification */}
        {showToast && (
          <div style={{ position: 'fixed', left: '50%', bottom: 40, transform: 'translateX(-50%)', background: '#23232a', color: '#fff', padding: '1em 2em', borderRadius: 12, boxShadow: '0 2px 12px 0 rgba(0,0,0,0.18)', fontWeight: 600, fontSize: 17, zIndex: 9999 }}>
            You have no token left today, come back tomorrow!
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AppContent />
    </GoogleOAuthProvider>
  )
}
