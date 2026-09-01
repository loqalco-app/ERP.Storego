'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [newPass, setNewPass]   = useState('')
  const [confPass, setConfPass] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [showNew, setShowNew]   = useState(false)
  const [showConf, setShowConf] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPass.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (newPass !== confPass)  { setError('Las contraseñas no coinciden.'); return }

    setSaving(true); setError('')
    const supabase = createClient()

    const { error: pwErr } = await supabase.auth.updateUser({ password: newPass })
    if (pwErr) { setSaving(false); setError(pwErr.message); return }

    // Clear the flag
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_profiles')
        .update({ must_change_password: false })
        .eq('id', user.id)
    }

    router.replace('/dashboard')
  }

  const EyeOpen  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  const EyeOff   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>

  const strength = newPass.length === 0 ? 0 : newPass.length < 6 ? 1 : newPass.length < 8 ? 2 : newPass.length < 12 ? 3 : 4
  const strengthColor = ['','#EF4444','#F59E0B','#3B82F6','#10B981'][strength]

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#ECEEF2;font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;min-height:100dvh}
        .page{min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
        .card{background:#ECEEF2;border-radius:28px;padding:32px 28px 36px;width:100%;max-width:400px;box-shadow:8px 8px 24px rgba(0,0,0,0.09),-6px -6px 16px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.70)}
        .logo{width:52px;height:52px;background:linear-gradient(135deg,#1D4ED8,#3B82F6);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:white;margin:0 auto 20px;box-shadow:0 8px 24px rgba(29,78,216,0.32)}
        .title{font-size:22px;font-weight:800;color:#0A0A0E;text-align:center;letter-spacing:-0.4px;margin-bottom:6px}
        .sub{font-size:13px;color:rgba(10,10,14,0.45);text-align:center;line-height:1.5;margin-bottom:28px}
        .fl{font-size:11px;font-weight:700;color:rgba(10,10,14,0.35);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
        .fi-wrap{position:relative;margin-bottom:14px}
        .fi{width:100%;padding:14px 48px 14px 16px;background:rgba(0,0,0,0.03);border:1.5px solid rgba(0,0,0,0.07);border-radius:16px;font-size:16px;font-weight:500;color:#0A0A0E;font-family:inherit;outline:none;transition:border-color 0.15s}
        .fi:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
        .eye-btn{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:rgba(10,10,14,0.40);padding:4px;display:flex;align-items:center}
        .strength{height:4px;border-radius:2px;margin-top:-10px;margin-bottom:14px;background:rgba(0,0,0,0.06);overflow:hidden}
        .alert-err{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:14px;padding:10px 14px;font-size:13px;font-weight:600;color:#991b1b;margin-bottom:16px}
        .submit-btn{width:100%;padding:16px;background:linear-gradient(145deg,#1D4ED8,#2563EB);border:none;border-radius:22px;font-size:16px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:0 8px 24px rgba(29,78,216,0.32);transition:opacity 0.15s,transform 0.12s}
        .submit-btn:hover{opacity:.92}
        .submit-btn:active{transform:scale(0.98)}
        .submit-btn:disabled{opacity:.5;cursor:not-allowed}
      `}</style>

      <div className="page">
        <div className="card">
          <div className="logo">S</div>
          <div className="title">Crea tu contraseña</div>
          <div className="sub">Es tu primer acceso. Elige una contraseña segura para continuar.</div>

          {error && <div className="alert-err">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="fl">Nueva contraseña</div>
            <div className="fi-wrap">
              <input className="fi" type={showNew ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" required />
              <button type="button" className="eye-btn" onClick={() => setShowNew(v => !v)}>
                {showNew ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>

            {newPass.length > 0 && (
              <div className="strength">
                <div style={{ height:'100%', borderRadius:2, width:`${strength * 25}%`, background:strengthColor, transition:'width .3s,background .3s' }} />
              </div>
            )}

            <div className="fl">Confirmar contraseña</div>
            <div className="fi-wrap">
              <input className="fi" type={showConf ? 'text' : 'password'} value={confPass} onChange={e => setConfPass(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password" required />
              <button type="button" className="eye-btn" onClick={() => setShowConf(v => !v)}>
                {showConf ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>

            <button type="submit" className="submit-btn" disabled={saving || !newPass || !confPass}>
              {saving ? 'Guardando...' : 'Guardar y entrar →'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
