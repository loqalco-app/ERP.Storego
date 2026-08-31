'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: #fff;
          position: relative;
          overflow: hidden;
        }

        /* ── Background blobs ── */
        .blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .blob-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%);
          top: -150px; right: -100px;
        }
        .blob-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(59,130,246,0.20) 0%, transparent 70%);
          bottom: -100px; left: -80px;
        }
        .blob-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%);
          top: 40%; left: 30%;
        }

        /* ── Glass card ── */
        .glass-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 400px;
          background: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(48px) saturate(200%) brightness(1.05);
          -webkit-backdrop-filter: blur(48px) saturate(200%) brightness(1.05);
          border-radius: 36px;
          border: 1px solid rgba(255, 255, 255, 0.75);
          box-shadow:
            0 32px 80px rgba(99, 102, 241, 0.12),
            0 8px 32px rgba(0, 0, 0, 0.08),
            inset 0 1.5px 0 rgba(255, 255, 255, 0.95),
            inset 0 -1px 0 rgba(255, 255, 255, 0.3);
          padding: 44px 40px 40px;
          overflow: hidden;
        }

        /* specular shimmer at top */
        .glass-card::before {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9) 40%, rgba(255,255,255,0.9) 60%, transparent);
          border-radius: 50%;
        }

        /* soft inner light */
        .glass-card::after {
          content: '';
          position: absolute;
          top: -60px; left: -60px;
          width: 220px; height: 220px;
          background: radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 70%);
          pointer-events: none;
        }

        /* ── Logo mark ── */
        .logo-mark {
          width: 56px; height: 56px;
          background: linear-gradient(145deg, #4F46E5 0%, #818CF8 100%);
          border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 28px;
          box-shadow:
            0 12px 32px rgba(79,70,229,0.35),
            inset 0 1px 0 rgba(255,255,255,0.3);
          position: relative;
          z-index: 1;
        }

        /* ── Headings ── */
        .login-title {
          font-size: 30px;
          font-weight: 800;
          color: #0A0A0F;
          letter-spacing: -0.8px;
          line-height: 1.05;
          margin-bottom: 6px;
          position: relative; z-index: 1;
        }
        .login-sub {
          font-size: 14px;
          color: rgba(10,10,15,0.45);
          font-weight: 400;
          margin-bottom: 36px;
          position: relative; z-index: 1;
        }

        /* ── Form ── */
        .form-group {
          margin-bottom: 14px;
          position: relative; z-index: 1;
        }
        .form-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: rgba(10,10,15,0.40);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .form-input {
          width: 100%;
          padding: 15px 18px;
          border-radius: 16px;
          border: 1.5px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.70);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          font-size: 15px;
          font-weight: 500;
          color: #0A0A0F;
          outline: none;
          transition: all 0.2s ease;
          font-family: inherit;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.04);
        }
        .form-input::placeholder { color: rgba(10,10,15,0.25); font-weight: 400; }
        .form-input:focus {
          border-color: rgba(79,70,229,0.45);
          background: rgba(255,255,255,0.92);
          box-shadow: 0 0 0 4px rgba(79,70,229,0.10), inset 0 1px 2px rgba(0,0,0,0.02);
        }

        /* ── Error ── */
        .error-box {
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.18);
          border-radius: 14px;
          padding: 11px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #DC2626;
          margin-bottom: 14px;
          position: relative; z-index: 1;
        }

        /* ── Button ── */
        .submit-btn {
          width: 100%;
          padding: 16px;
          margin-top: 8px;
          border-radius: 18px;
          background: linear-gradient(145deg, #4F46E5 0%, #6366F1 60%, #818CF8 100%);
          color: white;
          font-size: 15px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          letter-spacing: -0.1px;
          font-family: inherit;
          position: relative; z-index: 1;
          box-shadow:
            0 8px 24px rgba(79,70,229,0.40),
            inset 0 1px 0 rgba(255,255,255,0.25);
          transition: all 0.18s ease;
          overflow: hidden;
        }
        .submit-btn::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%);
          border-radius: 18px 18px 0 0;
          pointer-events: none;
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 32px rgba(79,70,229,0.45), inset 0 1px 0 rgba(255,255,255,0.25);
        }
        .submit-btn:active:not(:disabled) {
          transform: translateY(0px) scale(0.99);
        }
        .submit-btn:disabled { opacity: 0.6; cursor: default; }

        /* ── Footer ── */
        .login-footer {
          text-align: center;
          font-size: 12px;
          color: rgba(10,10,15,0.28);
          margin-top: 24px;
          position: relative; z-index: 1;
          font-weight: 500;
          letter-spacing: 0.01em;
        }
      `}</style>

      <div className="login-root">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />

        <div className="glass-card">
          {/* Logo */}
          <div className="logo-mark">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="9,22 9,12 15,12 15,22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h1 className="login-title">Bienvenido</h1>
          <p className="login-sub">Inicia sesión en Store ERP</p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Correo</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="tu@correo.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            {error && <div className="error-box">{error}</div>}

            <button className="submit-btn" type="submit" disabled={loading}>
              {loading ? 'Entrando…' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        <p className="login-footer">Store ERP · Acceso privado</p>
      </div>
    </>
  )
}
