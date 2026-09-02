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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }
    if (data.user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('must_change_password')
        .eq('id', data.user.id)
        .single()
      if (profile?.must_change_password) {
        router.push('/change-password')
        return
      }
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .root {
          min-height: 100dvh;
          background: #ECEEF2;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        .card {
          width: 100%;
          max-width: 390px;
          background: #ECEEF2;
          border-radius: 36px;
          padding: 44px 40px 40px;
          box-shadow:
            16px 16px 40px rgba(0,0,0,0.10),
            -10px -10px 28px rgba(255,255,255,0.95),
            inset 0 1.5px 0 rgba(255,255,255,0.90);
          position: relative;
          overflow: hidden;
        }

        /* top specular edge */
        .card::before {
          content: '';
          position: absolute;
          top: 0; left: 12%; right: 12%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,1) 40%, rgba(255,255,255,1) 60%, transparent);
        }

        .logo-wrap {
          width: 56px; height: 56px;
          border-radius: 18px;
          background: #ECEEF2;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 28px;
          box-shadow:
            6px 6px 16px rgba(0,0,0,0.12),
            -4px -4px 12px rgba(255,255,255,0.95),
            inset 0 1px 0 rgba(255,255,255,0.8);
        }

        h1 {
          font-size: 30px;
          font-weight: 800;
          color: #1A1A20;
          letter-spacing: -0.8px;
          line-height: 1.05;
          margin-bottom: 6px;
        }
        .sub {
          font-size: 14px;
          color: rgba(26,26,32,0.40);
          font-weight: 400;
          margin-bottom: 36px;
        }

        .label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: rgba(26,26,32,0.38);
          letter-spacing: 0.09em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .input {
          width: 100%;
          padding: 15px 18px;
          border-radius: 16px;
          border: none;
          background: #ECEEF2;
          font-size: 15px;
          font-weight: 500;
          color: #1A1A20;
          outline: none;
          font-family: inherit;
          margin-bottom: 16px;
          box-shadow:
            inset 4px 4px 10px rgba(0,0,0,0.08),
            inset -3px -3px 8px rgba(255,255,255,0.90);
          transition: box-shadow 0.2s ease;
        }
        .input::placeholder { color: rgba(26,26,32,0.22); font-weight: 400; }
        .input:focus {
          box-shadow:
            inset 4px 4px 10px rgba(0,0,0,0.10),
            inset -3px -3px 8px rgba(255,255,255,0.90),
            0 0 0 2.5px rgba(37,99,235,0.25);
        }

        .error {
          background: rgba(220,38,38,0.07);
          border: 1px solid rgba(220,38,38,0.15);
          border-radius: 14px;
          padding: 11px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #DC2626;
          margin-bottom: 16px;
        }

        .btn {
          width: 100%;
          padding: 16px;
          border-radius: 18px;
          border: none;
          cursor: pointer;
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          letter-spacing: -0.1px;
          color: white;
          background: linear-gradient(145deg, #1D4ED8 0%, #2563EB 60%, #3B82F6 100%);
          box-shadow:
            0 8px 24px rgba(29,78,216,0.38),
            0 2px 8px rgba(29,78,216,0.20),
            inset 0 1.5px 0 rgba(255,255,255,0.22);
          transition: all 0.18s ease;
          position: relative;
          overflow: hidden;
          margin-top: 4px;
        }
        .btn::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 48%;
          background: linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 100%);
          border-radius: 18px 18px 0 0;
          pointer-events: none;
        }
        .btn:hover:not(:disabled) {
          transform: translateY(-1.5px);
          box-shadow:
            0 14px 32px rgba(29,78,216,0.42),
            0 4px 12px rgba(29,78,216,0.22),
            inset 0 1.5px 0 rgba(255,255,255,0.22);
        }
        .btn:active:not(:disabled) { transform: translateY(0) scale(0.99); }
        .btn:disabled { opacity: 0.55; cursor: default; }

        .footer {
          text-align: center;
          font-size: 12px;
          color: rgba(26,26,32,0.25);
          margin-top: 24px;
          font-weight: 500;
          letter-spacing: 0.01em;
        }
      `}</style>

      <div className="root">
        <div>
          <div className="card">
            <div className="logo-wrap">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="3" y1="6" x2="21" y2="6" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 10a4 4 0 0 1-8 0" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <h1>Bienvenido</h1>
            <p className="sub">Inicia sesión en NORTHÉA</p>

            <form onSubmit={handleLogin}>
              <label className="label">Correo</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="tu@correo.com"
              />

              <label className="label">Contraseña</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />

              {error && <div className="error">{error}</div>}

              <button className="btn" type="submit" disabled={loading}>
                {loading ? 'Entrando…' : 'Iniciar sesión'}
              </button>
            </form>
          </div>

          <p className="footer">NORTHÉA · Acceso privado</p>
        </div>
      </div>
    </>
  )
}
