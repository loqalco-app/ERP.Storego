'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'

interface Props {
  userId: string
  email: string
  fullName: string
  phone: string
  orgName: string
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

export default function ProfileClient({ userId, email, fullName, phone, orgName }: Props) {
  const router = useRouter()
  const [name, setName]         = useState(fullName)
  const [tel, setTel]           = useState(phone)
  const [newEmail, setNewEmail] = useState(email)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const displayName = name || email.split('@')[0]

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setMsg({ type: 'err', text: 'El nombre es obligatorio.' }); return }
    setSaving(true); setMsg(null)

    const supabase = createClient()
    const { error: profileErr } = await supabase
      .from('user_profiles')
      .update({ full_name: name.trim(), phone: tel.trim() || null })
      .eq('id', userId)

    if (profileErr) {
      setSaving(false)
      setMsg({ type: 'err', text: 'Error al guardar el perfil. Inténtalo de nuevo.' })
      return
    }

    if (newEmail.trim() && newEmail.trim() !== email) {
      const { error: emailErr } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (emailErr) {
        setSaving(false)
        setMsg({ type: 'err', text: 'Perfil guardado, pero hubo un error al cambiar el correo: ' + emailErr.message })
        return
      }
      setSaving(false)
      setMsg({ type: 'ok', text: 'Perfil actualizado. Revisa tu nuevo correo para confirmar el cambio de email.' })
      return
    }

    setSaving(false)
    setMsg({ type: 'ok', text: 'Perfil actualizado correctamente.' })
    router.refresh()
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#ECEEF2;font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
        .shell{display:flex;min-height:100dvh}
        .main{flex:1;overflow-y:auto}
        .topbar{display:flex;align-items:center;gap:12px;padding:52px 20px 20px}
        @media(min-width:768px){.topbar{padding:32px 32px 24px}}
        .back-btn{width:38px;height:38px;border-radius:12px;background:#ECEEF2;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;box-shadow:4px 4px 12px rgba(0,0,0,0.08),-3px -3px 8px rgba(255,255,255,0.95);flex-shrink:0}
        .page-title{font-size:22px;font-weight:800;color:#1A1A20;letter-spacing:-0.4px}
        @media(min-width:768px){.page-title{font-size:26px}}
        .content{padding:0 16px 120px}
        @media(min-width:768px){.content{padding:0 32px 48px;max-width:640px;margin:0 auto}}
        .av-section{display:flex;align-items:center;gap:20px;margin-bottom:28px}
        .av{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#3B82F6);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:white;flex-shrink:0;box-shadow:0 8px 24px rgba(29,78,216,0.28)}
        .av-name{font-size:18px;font-weight:800;color:#1A1A20}
        .av-email{font-size:13px;color:rgba(26,26,32,0.40);margin-top:2px}
        .card{background:#ECEEF2;border-radius:24px;overflow:hidden;box-shadow:6px 6px 18px rgba(0,0,0,0.08),-4px -4px 12px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.7);margin-bottom:16px}
        .field{padding:14px 20px;border-top:1px solid rgba(0,0,0,0.05)}
        .field:first-child{border-top:none}
        .fl{font-size:11px;font-weight:700;color:rgba(26,26,32,0.35);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
        .fi{width:100%;padding:13px 16px;background:rgba(0,0,0,0.03);border:1.5px solid rgba(0,0,0,0.07);border-radius:14px;font-size:15px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none;box-shadow:inset 2px 2px 6px rgba(0,0,0,0.06),inset -2px -2px 5px rgba(255,255,255,0.80);transition:border-color 0.15s}
        .fi:focus{border-color:#2563EB;box-shadow:inset 2px 2px 6px rgba(0,0,0,0.06),inset -2px -2px 5px rgba(255,255,255,0.80),0 0 0 3px rgba(37,99,235,0.12)}
        .hint{font-size:11px;color:rgba(26,26,32,0.30);margin-top:5px;line-height:1.4}
        .sec-title{font-size:17px;font-weight:800;color:#1A1A20;letter-spacing:-0.3px;margin:20px 0 10px}
        .alert-ok{background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.18);border-radius:14px;padding:12px 16px;font-size:13px;font-weight:600;color:#065f46;margin-bottom:16px}
        .alert-err{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:14px;padding:12px 16px;font-size:13px;font-weight:600;color:#991b1b;margin-bottom:16px}
        .save-btn{width:100%;padding:16px;background:linear-gradient(145deg,#1D4ED8,#2563EB);border:none;border-radius:18px;font-size:16px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:0 8px 24px rgba(29,78,216,0.30),inset 0 1px 0 rgba(255,255,255,0.20);transition:opacity 0.15s,transform 0.12s;margin-top:8px}
        .save-btn:hover{opacity:.92}
        .save-btn:active{transform:scale(0.98)}
        .save-btn:disabled{opacity:.5;cursor:not-allowed}
      `}</style>

      <div className="shell">
        <Sidebar orgName={orgName} userName={displayName} active="settings" />
        <main className="main">
          <div className="topbar">
            <Link href="/dashboard" className="back-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A20" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </Link>
            <div className="page-title">Mi perfil</div>
          </div>

          <div className="content">
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
                <div className="field">
                  <div className="fl">Nombre completo *</div>
                  <input className="fi" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Jonathan Hernández" autoComplete="name" />
                </div>
                <div className="field">
                  <div className="fl">Teléfono</div>
                  <input className="fi" type="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="Ej. +52 55 1234 5678" autoComplete="tel" />
                </div>
              </div>

              <div className="sec-title">Acceso</div>
              <div className="card">
                <div className="field">
                  <div className="fl">Correo electrónico</div>
                  <input className="fi" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="correo@ejemplo.com" autoComplete="email" />
                  {newEmail !== email && <div className="hint">Se enviará un correo de confirmación a la nueva dirección.</div>}
                </div>
              </div>

              <button type="submit" className="save-btn" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </main>
      </div>

      <BottomNav active="settings" />
    </>
  )
}
