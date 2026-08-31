'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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
  const [name, setName] = useState(fullName)
  const [tel, setTel] = useState(phone)
  const [newEmail, setNewEmail] = useState(email)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ECEEF2; font-family: 'Inter', -apple-system, sans-serif; }

        .shell { display: flex; min-height: 100dvh; }

        /* Sidebar (desktop) */
        .sidebar {
          display: none; width: 240px; flex-shrink: 0;
          background: #ECEEF2; border-right: 1px solid rgba(0,0,0,0.06);
          padding: 28px 16px; flex-direction: column; gap: 4px;
          box-shadow: 4px 0 20px rgba(0,0,0,0.04);
          position: sticky; top: 0; height: 100vh;
        }
        @media (min-width: 768px) { .sidebar { display: flex; } }

        .sb-logo { display: flex; align-items: center; gap: 10px; padding: 4px 8px 20px; margin-bottom: 8px; border-bottom: 1px solid rgba(0,0,0,0.06); }
        .sb-logo-mark { width: 36px; height: 36px; background: linear-gradient(145deg, #1D4ED8, #3B82F6); border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(29,78,216,0.30); }
        .sb-logo-name { font-size: 15px; font-weight: 800; color: #1A1A20; letter-spacing: -0.3px; }
        .sb-logo-sub { font-size: 10px; color: rgba(26,26,32,0.35); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .sb-section { font-size: 10px; font-weight: 700; color: rgba(26,26,32,0.30); letter-spacing: 0.09em; text-transform: uppercase; padding: 14px 10px 4px; }
        .sb-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 12px; font-size: 13.5px; font-weight: 500; color: rgba(26,26,32,0.50); cursor: pointer; text-decoration: none; transition: all 0.12s; }
        .sb-item:hover { background: rgba(0,0,0,0.04); color: #1A1A20; }
        .sb-item.active { background: #ECEEF2; color: #1D4ED8; font-weight: 700; box-shadow: 3px 3px 10px rgba(0,0,0,0.08), -2px -2px 6px rgba(255,255,255,0.90); }
        .sb-footer { margin-top: auto; padding-top: 16px; border-top: 1px solid rgba(0,0,0,0.06); }
        .logout-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; margin-top: 4px; border-radius: 12px; border: none; background: transparent; font-size: 13px; font-weight: 500; color: rgba(26,26,32,0.40); cursor: pointer; font-family: inherit; transition: all 0.12s; }
        .logout-btn:hover { background: rgba(220,38,38,0.06); color: #DC2626; }

        /* Main */
        .main { flex: 1; overflow-y: auto; }

        /* Top bar */
        .topbar { display: flex; align-items: center; gap: 12px; padding: 52px 20px 20px; }
        @media (min-width: 768px) { .topbar { padding: 32px 32px 24px; } }
        .back-btn { width: 38px; height: 38px; border-radius: 12px; background: #ECEEF2; display: flex; align-items: center; justify-content: center; cursor: pointer; text-decoration: none; box-shadow: 4px 4px 12px rgba(0,0,0,0.08), -3px -3px 8px rgba(255,255,255,0.95); flex-shrink: 0; }
        .page-title { font-size: 22px; font-weight: 800; color: #1A1A20; letter-spacing: -0.4px; }
        @media (min-width: 768px) { .page-title { font-size: 26px; } }

        .content { padding: 0 16px 100px; }
        @media (min-width: 768px) { .content { padding: 0 32px 48px; max-width: 640px; } }

        /* Avatar */
        .av-section { display: flex; align-items: center; gap: 20px; margin-bottom: 28px; }
        .av { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, #1D4ED8, #3B82F6); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: white; flex-shrink: 0; box-shadow: 0 8px 24px rgba(29,78,216,0.28); }
        .av-info { flex: 1; }
        .av-name { font-size: 18px; font-weight: 800; color: #1A1A20; }
        .av-email { font-size: 13px; color: rgba(26,26,32,0.40); margin-top: 2px; }

        /* Card */
        .card { background: #ECEEF2; border-radius: 24px; padding: 4px 0; box-shadow: 6px 6px 18px rgba(0,0,0,0.08), -4px -4px 12px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.7); margin-bottom: 16px; overflow: hidden; }

        /* Field row */
        .field { padding: 4px 20px 16px; border-top: 1px solid rgba(0,0,0,0.05); }
        .field:first-child { border-top: none; padding-top: 16px; }
        .field-lbl { font-size: 11px; font-weight: 700; color: rgba(26,26,32,0.35); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .field-input {
          width: 100%; padding: 13px 16px;
          background: rgba(0,0,0,0.03);
          border: 1.5px solid rgba(0,0,0,0.07);
          border-radius: 14px;
          font-size: 15px; font-weight: 500; color: #1A1A20;
          font-family: inherit; outline: none;
          box-shadow: inset 2px 2px 6px rgba(0,0,0,0.06), inset -2px -2px 5px rgba(255,255,255,0.80);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .field-input:focus { border-color: #2563EB; box-shadow: inset 2px 2px 6px rgba(0,0,0,0.06), inset -2px -2px 5px rgba(255,255,255,0.80), 0 0 0 3px rgba(37,99,235,0.12); }
        .field-hint { font-size: 11px; color: rgba(26,26,32,0.30); margin-top: 5px; line-height: 1.4; }

        /* Section label */
        .section-hd { font-size: 17px; font-weight: 800; color: #1A1A20; letter-spacing: -0.3px; margin-bottom: 10px; margin-top: 8px; }

        /* Alert */
        .alert-ok { background: rgba(5,150,105,0.08); border: 1px solid rgba(5,150,105,0.18); border-radius: 14px; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #065f46; margin-bottom: 16px; }
        .alert-err { background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.15); border-radius: 14px; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #991b1b; margin-bottom: 16px; }

        /* Save button */
        .save-btn {
          width: 100%; padding: 16px;
          background: linear-gradient(145deg, #1D4ED8, #2563EB);
          border: none; border-radius: 18px;
          font-size: 16px; font-weight: 700; color: white;
          cursor: pointer; font-family: inherit;
          box-shadow: 0 8px 24px rgba(29,78,216,0.30), inset 0 1px 0 rgba(255,255,255,0.20);
          transition: opacity 0.15s, transform 0.12s;
          margin-top: 8px;
        }
        .save-btn:hover { opacity: 0.92; }
        .save-btn:active { transform: scale(0.98); }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Bottom nav (mobile) */
        .bottom-nav-wrap { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 398px; display: flex; align-items: center; gap: 10px; z-index: 100; }
        @media (min-width: 768px) { .bottom-nav-wrap { display: none; } }
        .nav-pill { flex: 1; background: #ECEEF2; border-radius: 50px; padding: 6px; display: flex; align-items: center; gap: 4px; box-shadow: 8px 8px 22px rgba(0,0,0,0.10), -5px -5px 14px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.80); }
        .nav-item { flex: 1; display: flex; align-items: center; justify-content: center; padding: 10px 8px; border-radius: 50px; color: rgba(26,26,32,0.32); text-decoration: none; transition: all 0.18s; }
        .nav-item.active { background: #1A1A20; color: white; flex: none; padding: 10px 20px; gap: 7px; font-size: 14px; font-weight: 700; }
        .fab { width: 56px; height: 56px; flex-shrink: 0; background: #1D4ED8; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 8px 24px rgba(29,78,216,0.38), inset 0 1px 0 rgba(255,255,255,0.20); border: none; }
      `}</style>

      <div className="shell">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sb-logo">
            <div className="sb-logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <div>
              <div className="sb-logo-name">{orgName}</div>
              <div className="sb-logo-sub">ERP</div>
            </div>
          </div>

          <div className="sb-section">Principal</div>
          <Link href="/dashboard" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10.707 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 19 11h-1v9a1 1 0 0 1-1 1h-4v-5h-2v5H7a1 1 0 0 1-1-1v-9H5a1 1 0 0 1-.707-1.707l7-7z"/></svg>
            Dashboard
          </Link>
          <Link href="/orders" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/></svg>
            Órdenes
          </Link>
          <Link href="/pos" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            POS
          </Link>

          <div className="sb-section">Catálogo</div>
          <Link href="/products" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 7h10M7 12h10M7 17h6"/></svg>
            Productos
          </Link>
          <Link href="/inventory" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            Inventario
          </Link>

          <div className="sb-section">Clientes</div>
          <Link href="/customers" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/><circle cx="17" cy="10" r="3"/><path d="M21 21a4 4 0 0 0-6 0"/></svg>
            CRM
          </Link>
          <Link href="/reports" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            Reportes
          </Link>

          <div className="sb-section">Sistema</div>
          <Link href="/settings/users" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
            Usuarios y roles
          </Link>
          <Link href="/settings" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            Configuración
          </Link>
          <Link href="/settings/profile" className="sb-item active">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
            Mi perfil
          </Link>

          <div className="sb-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {initials(fullName || email)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A20' }}>{fullName || email.split('@')[0]}</div>
                <div style={{ fontSize: 11, color: 'rgba(26,26,32,0.35)' }}>Administrador</div>
              </div>
            </div>
            <button className="logout-btn" onClick={async () => { const s = createClient(); await s.auth.signOut(); router.push('/login') }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <Link href="/dashboard" className="back-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A20" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </Link>
            <div className="page-title">Mi perfil</div>
          </div>

          <div className="content">
            {/* Avatar summary */}
            <div className="av-section">
              <div className="av">{initials(name || email)}</div>
              <div className="av-info">
                <div className="av-name">{name || 'Sin nombre'}</div>
                <div className="av-email">{email}</div>
              </div>
            </div>

            {msg && (
              <div className={msg.type === 'ok' ? 'alert-ok' : 'alert-err'}>{msg.text}</div>
            )}

            <form onSubmit={handleSave}>
              <div className="section-hd">Información personal</div>
              <div className="card">
                <div className="field">
                  <div className="field-lbl">Nombre completo *</div>
                  <input
                    className="field-input"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej. Jonathan Hernández"
                    autoComplete="name"
                  />
                </div>
                <div className="field">
                  <div className="field-lbl">Teléfono</div>
                  <input
                    className="field-input"
                    type="tel"
                    value={tel}
                    onChange={e => setTel(e.target.value)}
                    placeholder="Ej. +52 55 1234 5678"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="section-hd">Acceso</div>
              <div className="card">
                <div className="field">
                  <div className="field-lbl">Correo electrónico</div>
                  <input
                    className="field-input"
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    autoComplete="email"
                  />
                  {newEmail !== email && (
                    <div className="field-hint">Se enviará un correo de confirmación a la nueva dirección.</div>
                  )}
                </div>
              </div>

              <button type="submit" className="save-btn" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <div className="bottom-nav-wrap">
        <div className="nav-pill">
          {[
            { href: '/dashboard', label: 'Inicio', active: false, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10.707 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 19 11h-1v9a1 1 0 0 1-1 1h-4v-5h-2v5H7a1 1 0 0 1-1-1v-9H5a1 1 0 0 1-.707-1.707l7-7z"/></svg> },
            { href: '/orders', label: 'Órdenes', active: false, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/></svg> },
            { href: '/products', label: 'Productos', active: false, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 7h10M7 12h10M7 17h6"/></svg> },
            { href: '/customers', label: 'Clientes', active: false, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/></svg> },
          ].map(item => (
            <Link key={item.href} href={item.href} className={`nav-item${item.active ? ' active' : ''}`}>
              {item.icon}
              {item.active && <span>{item.label}</span>}
            </Link>
          ))}
        </div>
        <Link href="/settings/profile" className="fab">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
        </Link>
      </div>
    </>
  )
}
