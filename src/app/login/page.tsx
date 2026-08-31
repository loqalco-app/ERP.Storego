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
    <main style={{
      minHeight: '100dvh',
      background: '#F5F5F7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(59,130,246,0.12) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '380px' }}>

        {/* Glass card */}
        <div style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          borderRadius: '32px',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.8) inset',
          padding: '40px 36px 36px',
        }}>

          {/* Logo */}
          <div style={{ marginBottom: '36px' }}>
            <div style={{
              width: '52px', height: '52px',
              background: 'linear-gradient(145deg, #2563EB 0%, #60A5FA 100%)',
              borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '24px',
              boxShadow: '0 8px 24px rgba(37,99,235,0.30)',
            }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '18px', letterSpacing: '-0.5px' }}>S</span>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0A0A0B', letterSpacing: '-0.5px', lineHeight: 1.1, margin: 0 }}>
              Bienvenido
            </h1>
            <p style={{ fontSize: '14px', color: '#8A8A8E', marginTop: '6px', fontWeight: 400 }}>
              Inicia sesión en Store ERP
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B6B70', marginBottom: '8px', letterSpacing: '0.02em' }}>
                CORREO
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="tu@correo.com"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1.5px solid #EBEBED',
                  background: '#FAFAFB',
                  fontSize: '15px',
                  color: '#0A0A0B',
                  outline: 'none',
                  transition: 'all 0.15s',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
                onFocus={e => { e.currentTarget.style.border = '1.5px solid #2563EB'; e.currentTarget.style.background = '#fff'; }}
                onBlur={e => { e.currentTarget.style.border = '1.5px solid #EBEBED'; e.currentTarget.style.background = '#FAFAFB'; }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B6B70', marginBottom: '8px', letterSpacing: '0.02em' }}>
                CONTRASEÑA
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1.5px solid #EBEBED',
                  background: '#FAFAFB',
                  fontSize: '15px',
                  color: '#0A0A0B',
                  outline: 'none',
                  transition: 'all 0.15s',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
                onFocus={e => { e.currentTarget.style.border = '1.5px solid #2563EB'; e.currentTarget.style.background = '#fff'; }}
                onBlur={e => { e.currentTarget.style.border = '1.5px solid #EBEBED'; e.currentTarget.style.background = '#FAFAFB'; }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: '12px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#DC2626',
                fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '6px',
                padding: '15px',
                borderRadius: '16px',
                background: loading ? '#93C5FD' : 'linear-gradient(145deg, #2563EB 0%, #3B82F6 100%)',
                color: 'white',
                fontSize: '15px',
                fontWeight: 700,
                border: 'none',
                cursor: loading ? 'default' : 'pointer',
                boxShadow: loading ? 'none' : '0 6px 20px rgba(37,99,235,0.35)',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
                letterSpacing: '-0.1px',
              }}
            >
              {loading ? 'Entrando…' : 'Iniciar sesión'}
            </button>
          </form>

        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#AEAEB2', marginTop: '20px' }}>
          Store ERP · Acceso privado
        </p>
      </div>
    </main>
  )
}
