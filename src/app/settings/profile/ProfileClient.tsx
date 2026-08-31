'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

interface Props { userId: string; email: string; fullName: string; phone: string; orgName: string }

function initials(name: string) { return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?' }

export default function ProfileClient({ userId, email, fullName, phone, orgName }: Props) {
  const router = useRouter()
  const [name, setName]         = useState(fullName)
  const [tel, setTel]           = useState(phone)
  const [newEmail, setNewEmail] = useState(email)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [newPass, setNewPass]   = useState('')
  const [confPass, setConfPass] = useState('')
  const [savingPass, setSavingPass] = useState(false)
  const [passMsg, setPassMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showNew, setShowNew]   = useState(false)
  const [showConf, setShowConf] = useState(false)

  const displayName = name || email.split('@')[0]

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setMsg({ type: 'err', text: 'El nombre es obligatorio.' }); return }
    setSaving(true); setMsg(null)
    const supabase = createClient()
    const { error: profileErr } = await supabase.from('user_profiles').update({ full_name: name.trim(), phone: tel.trim()||null }).eq('id', userId)
    if (profileErr) { setSaving(false); setMsg({ type: 'err', text: 'Error al guardar el perfil.' }); return }
    if (newEmail.trim() && newEmail.trim() !== email) {
      const { error: emailErr } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (emailErr) { setSaving(false); setMsg({ type: 'err', text: 'Perfil guardado, pero error al cambiar el correo: ' + emailErr.message }); return }
      setSaving(false); setMsg({ type: 'ok', text: 'Perfil actualizado. Revisa tu nuevo correo para confirmar el cambio.' }); return
    }
    setSaving(false); setMsg({ type: 'ok', text: 'Perfil actualizado correctamente.' }); router.refresh()
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPass.length < 8) { setPassMsg({ type: 'err', text: 'Mínimo 8 caracteres.' }); return }
    if (newPass !== confPass) { setPassMsg({ type: 'err', text: 'Las contraseñas no coinciden.' }); return }
    setSavingPass(true); setPassMsg(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password: newPass })
    if (err) { setSavingPass(false); setPassMsg({ type: 'err', text: err.message }); return }
    setSavingPass(false)
    setPassMsg({ type: 'ok', text: 'Contraseña actualizada correctamente.' })
    setNewPass(''); setConfPass('')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:var(--font,'Inter',-apple-system,sans-serif);-webkit-font-smoothing:antialiased}
        .topbar{padding-bottom:20px}
        .back-btn{width:38px;height:38px;border-radius:var(--r-sm,12px);background:var(--bg,#ECEEF2);display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;box-shadow:var(--shadow-sm);flex-shrink:0}
        .page-title{font-size:22px;font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-0.4px}
        @media(min-width:768px){.page-title{font-size:var(--text-xl,26px)}}
        .content{padding:0 20px calc(var(--nav-h,88px) + 16px)}
        @media(min-width:768px){.content{padding:0 40px calc(var(--nav-h,88px) + 16px);max-width:640px;margin:0 auto}}
        .av-section{display:flex;align-items:center;gap:20px;margin-bottom:28px}
        .av{width:72px;height:72px;border-radius:50%;background:var(--grad-brand,linear-gradient(135deg,#1D4ED8,#3B82F6));display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:white;flex-shrink:0;box-shadow:var(--shadow-brand-sm)}
        .av-name{font-size:18px;font-weight:800;color:var(--text-1,#1A1A20)}
        .av-email{font-size:13px;color:var(--text-3,rgba(26,26,32,0.40));margin-top:2px}
        .card{background:var(--bg,#ECEEF2);border-radius:var(--r-xl,24px);overflow:hidden;box-shadow:var(--shadow-card);margin-bottom:16px}
        .field{padding:14px 20px;border-top:1px solid var(--border-light,rgba(0,0,0,0.04))}
        .field:first-child{border-top:none}
        .fl{font-size:11px;font-weight:700;color:var(--text-4,rgba(26,26,32,0.35));text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
        .fi{width:100%;padding:13px 16px;background:rgba(0,0,0,0.03);border:1.5px solid var(--border,rgba(0,0,0,0.07));border-radius:var(--r-md,16px);font-size:15px;font-weight:500;color:var(--text-1,#1A1A20);font-family:inherit;outline:none;box-shadow:var(--shadow-inset);transition:border-color 0.15s}
        .fi:focus{border-color:var(--brand-mid,#2563EB);box-shadow:var(--shadow-inset),0 0 0 3px var(--brand-alpha,rgba(37,99,235,0.12))}
        .hint{font-size:11px;color:var(--text-4,rgba(26,26,32,0.30));margin-top:5px;line-height:1.4}
        .sec-title{font-size:var(--text-md,17px);font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-0.3px;margin:20px 0 10px}
        .alert-ok{background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.18);border-radius:var(--r-md,16px);padding:12px 16px;font-size:13px;font-weight:600;color:#065f46;margin-bottom:16px}
        .alert-err{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:var(--r-md,16px);padding:12px 16px;font-size:13px;font-weight:600;color:#991b1b;margin-bottom:16px}
        .save-btn{width:100%;padding:16px;background:var(--grad-brand-btn,linear-gradient(145deg,#1D4ED8,#2563EB));border:none;border-radius:var(--r-xl,24px);font-size:16px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:var(--shadow-brand);transition:opacity 0.15s,transform 0.12s;margin-top:8px}
        .save-btn:hover{opacity:.92}
        .save-btn:active{transform:scale(0.98)}
        .save-btn:disabled{opacity:.5;cursor:not-allowed}
        .fi-wrap{position:relative}
        .eye-btn{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:rgba(10,10,14,0.40);padding:4px;display:flex;align-items:center}
        .pass-save-btn{width:100%;padding:14px;background:rgba(0,0,0,0.05);border:none;border-radius:var(--r-xl,24px);font-size:15px;font-weight:700;color:var(--text-2,#0A0A0E);cursor:pointer;font-family:inherit;transition:background 0.15s,transform 0.12s;margin-top:8px}
        .pass-save-btn:hover{background:rgba(0,0,0,0.09)}
        .pass-save-btn:active{transform:scale(0.98)}
        .pass-save-btn:disabled{opacity:.4;cursor:not-allowed}
        .settings-nav{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
        .snav-link{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:var(--r-md,16px);background:var(--bg,#ECEEF2);box-shadow:var(--shadow-sm);text-decoration:none;font-size:13px;font-weight:700;color:var(--text-2,#0A0A0E);transition:box-shadow 0.15s}
        .snav-link.active{background:var(--brand-alpha,rgba(29,78,216,0.10));color:var(--brand,#1D4ED8)}
        .snav-link:hover{box-shadow:var(--shadow-md)}
      `}</style>

      <Sidebar active="settings" />

      <div className="topbar">
        <Link href="/dashboard" className="back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-1,#1A1A20)" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div className="page-title">Mi perfil</div>
      </div>

      <div className="content">
        <div className="settings-nav">
          <Link href="/settings/profile" className="snav-link active">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
            Mi perfil
          </Link>
          <Link href="/settings/team" className="snav-link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/><circle cx="17" cy="10" r="3"/><path d="M21 21a4 4 0 0 0-6 0"/></svg>
            Equipo
          </Link>
        </div>

        <div className="av-section">
          <div className="av">{initials(name || email)}</div>
          <div>
            <div className="av-name">{name || 'Sin nombre'}</div>
            <div className="av-email">{email}</div>
          </div>
        </div>

        {msg && <div className={msg.type === 'ok' ? 'alert-ok' : 'alert-err'}>{msg.text}</div>}

        <form onSubmit={handleSave}>
          <div className="sec-title">Información personal</div>
          <div className="card">
            <div className="field"><div className="fl">Nombre completo *</div><input className="fi" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Jonathan Hernández" autoComplete="name" /></div>
            <div className="field"><div className="fl">Teléfono</div><input className="fi" type="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="Ej. +52 55 1234 5678" autoComplete="tel" /></div>
          </div>

          <div className="sec-title">Acceso</div>
          <div className="card">
            <div className="field">
              <div className="fl">Correo electrónico</div>
              <input className="fi" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="correo@ejemplo.com" autoComplete="email" />
              {newEmail !== email && <div className="hint">Se enviará un correo de confirmación a la nueva dirección.</div>}
            </div>
          </div>

          <button type="submit" className="save-btn" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </form>

        <form onSubmit={handleChangePassword}>
          <div className="sec-title">Contraseña</div>
          {passMsg && <div className={passMsg.type === 'ok' ? 'alert-ok' : 'alert-err'}>{passMsg.text}</div>}
          <div className="card">
            <div className="field">
              <div className="fl">Nueva contraseña</div>
              <div className="fi-wrap">
                <input className="fi" type={showNew ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
                <button type="button" className="eye-btn" onClick={() => setShowNew(v => !v)}>
                  {showNew
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            <div className="field">
              <div className="fl">Confirmar contraseña</div>
              <div className="fi-wrap">
                <input className="fi" type={showConf ? 'text' : 'password'} value={confPass} onChange={e => setConfPass(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password" />
                <button type="button" className="eye-btn" onClick={() => setShowConf(v => !v)}>
                  {showConf
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
          </div>
          <button type="submit" className="pass-save-btn" disabled={savingPass || !newPass}>{savingPass ? 'Cambiando...' : 'Cambiar contraseña'}</button>
        </form>
      </div>
    </>
  )
}
