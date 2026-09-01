'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

interface Member     { id: string; full_name: string; avatar_url: string | null; role: string; status: string; created_at: string }
interface Invitation { id: string; email: string; role: string; status: string; created_at: string; expires_at: string }

interface Props {
  initialTab: 'profile' | 'team'
  userId: string; email: string; fullName: string; phone: string
  orgId: string; orgName: string; myUserId: string; myRole: string; myEmail: string
  members: Member[]; invitations: Invitation[]; migrationNeeded?: boolean
}

const ROLE_META: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  owner:  { label: 'Propietario', color: '#7C3AED', bg: 'rgba(124,58,237,0.10)', desc: 'Acceso total, no removible' },
  admin:  { label: 'Admin',       color: '#1D4ED8', bg: 'rgba(29,78,216,0.10)',  desc: 'Todo el sistema + invitar usuarios' },
  staff:  { label: 'Staff',       color: '#059669', bg: 'rgba(5,150,105,0.10)',  desc: 'POS, inventario, clientes' },
  viewer: { label: 'Lector',      color: '#D97706', bg: 'rgba(217,119,6,0.10)',  desc: 'Solo lectura del dashboard' },
}
const MODULES: Record<string, string[]> = {
  owner:  ['Dashboard','POS','Inventario','Clientes','Equipo','Configuración'],
  admin:  ['Dashboard','POS','Inventario','Clientes','Equipo','Configuración'],
  staff:  ['Dashboard','POS','Inventario','Clientes'],
  viewer: ['Dashboard'],
}

function initials(name: string) { return name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?' }
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  if (diff < 60000) return 'ahora'
  if (diff < 3600000) return `${Math.floor(diff/60000)}m`
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h`
  return `${Math.floor(diff/86400000)}d`
}

export default function SettingsClient({
  initialTab, userId, email, fullName, phone,
  orgId, orgName, myUserId, myRole, myEmail,
  members: initMembers, invitations: initInvitations, migrationNeeded,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'profile'|'team'>(initialTab)

  function switchTab(t: 'profile'|'team') {
    setTab(t)
    // Actualiza URL sin navegar para que refresh mantenga el tab
    const url = new URL(window.location.href)
    if (t === 'team') url.searchParams.set('tab', 'team')
    else url.searchParams.delete('tab')
    window.history.replaceState(null, '', url.toString())
  }

  /* Perfil */
  const [name, setName]         = useState(fullName)
  const [tel, setTel]           = useState(phone)
  const [newEmail, setNewEmail] = useState(email)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState<{ type:'ok'|'err'; text:string }|null>(null)

  /* Contraseña */
  const [curPass,  setCurPass]  = useState('')
  const [newPass,  setNewPass]  = useState('')
  const [confPass, setConfPass] = useState('')
  const [savingPass, setSavingPass] = useState(false)
  const [passMsg, setPassMsg]   = useState<{ type:'ok'|'err'; text:string }|null>(null)
  const [showCur,  setShowCur]  = useState(false)
  const [showNew,  setShowNew]  = useState(false)
  const [showConf, setShowConf] = useState(false)

  /* Equipo */
  const [memberList, setMemberList] = useState<Member[]>(initMembers)
  const [invList,    setInvList]    = useState<Invitation[]>(initInvitations)
  const [updatingId, setUpdatingId] = useState<string|null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [invFirstName, setInvFirstName] = useState('')
  const [invLastName,  setInvLastName]  = useState('')
  const [invEmail, setInvEmail] = useState('')
  const [invRole,  setInvRole]  = useState('staff')
  const [sending,  setSending]  = useState(false)
  const [invMsg,   setInvMsg]   = useState<{ type:'ok'|'err'; text:string }|null>(null)

  const canManage = ['owner','admin'].includes(myRole)

  // Escape cierra cualquier modal abierto
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowInvite(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setMsg({ type:'err', text:'El nombre es obligatorio.' }); return }
    setSaving(true); setMsg(null)
    const supabase = createClient()
    const { error } = await supabase.from('user_profiles').update({ full_name: name.trim(), phone: tel.trim()||null }).eq('id', userId)
    if (error) { setSaving(false); setMsg({ type:'err', text:'Error al guardar el perfil.' }); return }
    if (newEmail.trim() && newEmail.trim() !== email) {
      const { error: eErr } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (eErr) { setSaving(false); setMsg({ type:'err', text:'Perfil guardado, pero error al cambiar correo: ' + eErr.message }); return }
      setSaving(false); setMsg({ type:'ok', text:'Perfil actualizado. Revisa tu nuevo correo para confirmar.' }); return
    }
    setSaving(false); setMsg({ type:'ok', text:'Perfil actualizado correctamente.' }); router.refresh()
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!curPass) { setPassMsg({ type:'err', text:'Ingresa tu contraseña actual.' }); return }
    if (newPass.length < 8) { setPassMsg({ type:'err', text:'Mínimo 8 caracteres.' }); return }
    if (newPass !== confPass) { setPassMsg({ type:'err', text:'Las contraseñas no coinciden.' }); return }
    setSavingPass(true); setPassMsg(null)
    const supabase = createClient()
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: curPass })
    if (authErr) { setSavingPass(false); setPassMsg({ type:'err', text:'Contraseña actual incorrecta.' }); return }
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (error) { setSavingPass(false); setPassMsg({ type:'err', text: error.message }); return }
    setSavingPass(false)
    setPassMsg({ type:'ok', text:'Contraseña actualizada correctamente.' })
    setCurPass(''); setNewPass(''); setConfPass('')
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!invEmail.trim() || !invFirstName.trim()) return
    setSending(true); setInvMsg(null)
    const fullName2 = `${invFirstName.trim()} ${invLastName.trim()}`.trim()
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: invEmail.trim(), role: invRole, orgId, fullName: fullName2 }),
    })
    const data = await res.json()
    if (!res.ok) { setInvMsg({ type:'err', text: data.error ?? 'Error al enviar invitación' }); setSending(false); return }
    setInvMsg({ type:'ok', text: data.method === 'resend' ? `Invitación enviada a ${invEmail}` : `Invitación creada. Agrega RESEND_API_KEY para emails.` })
    setInvFirstName(''); setInvLastName(''); setInvEmail(''); setInvRole('staff'); setSending(false)
    setInvList(prev => [{ id: Date.now().toString(), email: invEmail.trim(), role: invRole, status:'pending', created_at: new Date().toISOString(), expires_at: new Date(Date.now()+7*86400000).toISOString() }, ...prev])
    setTimeout(() => { setShowInvite(false); setInvMsg(null) }, 2500)
  }

  async function cancelInvitation(invId: string) {
    setUpdatingId(invId)
    // Intentar cancelar vía API (usa adminClient server-side, bypasea RLS)
    const res = await fetch('/api/team/invite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId: invId, orgId }),
    })
    if (res.ok) {
      setInvList(prev => prev.filter(i => i.id !== invId))
    } else {
      const body = await res.json().catch(() => ({}))
      alert('Error al cancelar: ' + (body.error ?? res.status))
    }
    setUpdatingId(null)
  }

  async function changeRole(memberId: string, newRole: string) {
    setUpdatingId(memberId)
    const supabase = createClient()
    const { error } = await supabase.from('user_profiles').update({ role: newRole }).eq('id', memberId).eq('organization_id', orgId)
    if (!error) setMemberList(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    setUpdatingId(null)
  }

  const EyeIcon = ({ show }: { show: boolean }) => show
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:var(--font,'Inter',-apple-system,sans-serif);-webkit-font-smoothing:antialiased}
        .topbar{padding-bottom:20px}
        .back-btn{width:38px;height:38px;border-radius:var(--r-sm,12px);background:var(--bg,#ECEEF2);display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;box-shadow:var(--shadow-sm);flex-shrink:0}
        .content{padding-left:20px;padding-right:20px;padding-bottom:calc(var(--nav-h,88px) + 16px)}
        @media(min-width:768px){.content{padding-left:40px;padding-right:40px;padding-bottom:calc(var(--nav-h,88px) + 16px);max-width:640px;margin:0 auto}}
        .settings-nav{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
        .snav-btn{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:var(--r-md,16px);background:var(--bg,#ECEEF2);box-shadow:var(--shadow-sm);font-size:13px;font-weight:700;color:var(--text-2,#0A0A0E);transition:box-shadow 0.15s;border:none;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent}
        .snav-btn.active{background:var(--brand-alpha,rgba(29,78,216,0.10));color:var(--brand,#1D4ED8);box-shadow:none}
        .snav-btn:hover:not(.active){box-shadow:var(--shadow-md)}
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
        .fi-wrap{position:relative}
        .fi-wrap .fi{padding-right:48px}
        .eye-btn{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:rgba(10,10,14,0.40);padding:4px;display:flex;align-items:center}
        .hint{font-size:11px;color:var(--text-4,rgba(26,26,32,0.30));margin-top:5px;line-height:1.4}
        .alert-ok{background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.18);border-radius:var(--r-md,16px);padding:12px 16px;font-size:13px;font-weight:600;color:#065f46;margin-bottom:16px}
        .alert-err{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:var(--r-md,16px);padding:12px 16px;font-size:13px;font-weight:600;color:#991b1b;margin-bottom:16px}
        .save-btn{width:100%;padding:16px;background:var(--grad-brand-btn,linear-gradient(145deg,#1D4ED8,#2563EB));border:none;border-radius:var(--r-xl,24px);font-size:16px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:var(--shadow-brand);transition:opacity 0.15s,transform 0.12s;margin-top:8px}
        .save-btn:hover{opacity:.92}
        .save-btn:active{transform:scale(0.98)}
        .save-btn:disabled{opacity:.5;cursor:not-allowed}
        .pass-save-btn{width:100%;padding:14px;background:rgba(0,0,0,0.05);border:none;border-radius:var(--r-xl,24px);font-size:15px;font-weight:700;color:var(--text-2,#0A0A0E);cursor:pointer;font-family:inherit;transition:background 0.15s,transform 0.12s;margin-top:8px}
        .pass-save-btn:hover{background:rgba(0,0,0,0.09)}
        .pass-save-btn:active{transform:scale(0.98)}
        .pass-save-btn:disabled{opacity:.4;cursor:not-allowed}
        .strength{height:4px;border-radius:2px;margin-top:8px;background:rgba(0,0,0,0.06);overflow:hidden}
        .strength-bar{height:100%;border-radius:2px;transition:width 0.3s,background 0.3s}
        .section-hd{display:flex;align-items:center;justify-content:space-between;margin:20px 0 10px}
        /* sec-title ya viene de globals.css — aquí solo ajustamos el layout de la fila */
        .section-hd .sec-title{margin:0}
        .invite-btn{display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:var(--grad-brand-btn,linear-gradient(145deg,#1D4ED8,#2563EB));color:white;border:none;border-radius:50%;cursor:pointer;font-family:inherit;box-shadow:var(--shadow-brand-sm);transition:opacity 0.15s,transform 0.12s;flex-shrink:0}
        .invite-btn:hover{opacity:.90}
        .invite-btn:active{transform:scale(0.93)}
        @media(min-width:480px){.invite-btn{width:auto;height:auto;border-radius:var(--r-pill,50px);padding:9px 18px;gap:6px}}
        .invite-btn-lbl{display:none}
        @media(min-width:480px){.invite-btn-lbl{display:inline;font-size:13px;font-weight:700}}
        .member-row{display:flex;align-items:center;gap:12px;padding:13px 18px;border-top:1px solid var(--border-light,rgba(0,0,0,0.04))}
        .member-row:first-child{border-top:none}
        .av-sm{width:40px;height:40px;border-radius:50%;background:var(--grad-brand,linear-gradient(135deg,#1D4ED8,#3B82F6));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:white;flex-shrink:0}
        .av-sm.invited{background:linear-gradient(135deg,#9CA3AF,#6B7280)}
        .member-name{font-size:14px;font-weight:700;color:var(--text-1,#1A1A20)}
        .member-sub{font-size:12px;color:var(--text-3,rgba(26,26,32,0.40));margin-top:2px}
        .member-right{margin-left:auto;display:flex;align-items:center;gap:10px;flex-shrink:0}
        .badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:var(--r-pill,50px);font-size:11px;font-weight:700}
        .role-select{appearance:none;border:none;border-radius:var(--r-sm,12px);padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
        .role-select:disabled{opacity:0.5;cursor:default}
        .modules-chip{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
        .mod{padding:2px 8px;border-radius:var(--r-pill,50px);background:rgba(0,0,0,0.05);font-size:10px;font-weight:600;color:var(--text-3,rgba(26,26,32,0.45))}
        .inv-tag{font-size:11px;font-weight:600;color:#D97706;background:rgba(217,119,6,0.10);padding:2px 8px;border-radius:var(--r-pill,50px)}
        .cancel-btn{width:28px;height:28px;border-radius:50%;border:none;background:rgba(220,38,38,0.08);color:#DC2626;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.12s;flex-shrink:0}
        .cancel-btn:hover{background:rgba(220,38,38,0.15)}
        .cancel-btn:disabled{opacity:0.4;cursor:default}
        .empty{padding:32px;text-align:center;color:var(--text-3);font-size:13px;font-weight:500}
        .modal-scrim{position:fixed;inset:0;background:rgba(0,0,0,0.44);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:500;display:flex;align-items:flex-end;justify-content:center}
        @media(min-width:600px){.modal-scrim{align-items:center}}
        .modal{background:var(--bg,#ECEEF2);border-radius:var(--r-2xl,28px);padding:28px 24px 32px;width:100%;max-width:480px;box-shadow:var(--shadow-float);margin:0 8px 8px}
        .modal-title{font-size:20px;font-weight:800;color:var(--text-1,#1A1A20);margin-bottom:4px;letter-spacing:-0.3px}
        .modal-sub{font-size:13px;color:var(--text-3,rgba(26,26,32,0.40));margin-bottom:24px}
        .name-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
        .mfi{width:100%;padding:13px 16px;background:rgba(0,0,0,0.03);border:1.5px solid var(--border,rgba(0,0,0,0.07));border-radius:var(--r-md,16px);font-size:15px;font-weight:500;color:var(--text-1,#1A1A20);font-family:inherit;outline:none;transition:border-color 0.15s;margin-bottom:14px}
        .mfi:focus{border-color:var(--brand-mid,#2563EB)}
        .role-pills{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
        .rpill{flex:1;min-width:80px;padding:10px 8px;border-radius:var(--r-md,16px);border:1.5px solid var(--border,rgba(0,0,0,0.08));background:var(--bg,#ECEEF2);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s;text-align:center}
        .rpill.on{border-color:var(--brand,#1D4ED8);background:var(--brand-alpha,rgba(29,78,216,0.10));color:var(--brand,#1D4ED8)}
        .rpill-desc{font-size:10px;font-weight:500;opacity:0.65;display:block;margin-top:2px;line-height:1.3}
        .modules-preview{background:rgba(0,0,0,0.04);border-radius:var(--r-md,16px);padding:10px 14px;margin-bottom:20px}
        .modules-preview-title{font-size:10px;font-weight:700;color:var(--text-4);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
        .mod-list{display:flex;flex-wrap:wrap;gap:5px}
        .modal-actions{display:flex;gap:10px}
        .btn-cancel{flex:1;padding:14px;border-radius:var(--r-xl,24px);border:1.5px solid var(--border,rgba(0,0,0,0.10));background:transparent;font-size:15px;font-weight:700;color:var(--text-2);cursor:pointer;font-family:inherit;transition:background 0.12s}
        .btn-cancel:hover{background:rgba(0,0,0,0.04)}
        .btn-send{flex:2;padding:14px;border-radius:var(--r-xl,24px);border:none;background:var(--grad-brand-btn,linear-gradient(145deg,#1D4ED8,#2563EB));font-size:15px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:var(--shadow-brand);transition:opacity 0.15s}
        .btn-send:hover{opacity:.92}
        .btn-send:disabled{opacity:.5;cursor:not-allowed}
      `}</style>

      <Sidebar active="settings" />

      <div className="topbar">
        <Link href="/dashboard" className="back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-1,#1A1A20)" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div className="page-title">Ajustes</div>
      </div>

      <div className="content">
        <div className="settings-nav">
          <button className={`snav-btn${tab === 'profile' ? ' active' : ''}`} onClick={() => switchTab('profile')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
            Mi perfil
          </button>
          <button className={`snav-btn${tab === 'team' ? ' active' : ''}`} onClick={() => switchTab('team')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/><circle cx="17" cy="10" r="3"/><path d="M21 21a4 4 0 0 0-6 0"/></svg>
            Equipo
          </button>
        </div>

        {tab === 'profile' && (
          <>
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
                  <div className="fl">Contraseña actual</div>
                  <div className="fi-wrap">
                    <input className="fi" type={showCur ? 'text' : 'password'} value={curPass} onChange={e => setCurPass(e.target.value)} placeholder="Tu contraseña actual" autoComplete="current-password" />
                    <button type="button" className="eye-btn" onClick={() => setShowCur(v => !v)}><EyeIcon show={showCur} /></button>
                  </div>
                </div>
                <div className="field">
                  <div className="fl">Nueva contraseña</div>
                  <div className="fi-wrap">
                    <input className="fi" type={showNew ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
                    <button type="button" className="eye-btn" onClick={() => setShowNew(v => !v)}><EyeIcon show={showNew} /></button>
                  </div>
                  {newPass.length > 0 && (
                    <div className="strength">
                      <div className="strength-bar" style={{
                        width: newPass.length < 6 ? '25%' : newPass.length < 8 ? '50%' : newPass.length < 12 ? '75%' : '100%',
                        background: newPass.length < 6 ? '#EF4444' : newPass.length < 8 ? '#F59E0B' : newPass.length < 12 ? '#3B82F6' : '#10B981',
                      }} />
                    </div>
                  )}
                </div>
                <div className="field">
                  <div className="fl">Confirmar contraseña</div>
                  <div className="fi-wrap">
                    <input className="fi" type={showConf ? 'text' : 'password'} value={confPass} onChange={e => setConfPass(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password" />
                    <button type="button" className="eye-btn" onClick={() => setShowConf(v => !v)}><EyeIcon show={showConf} /></button>
                  </div>
                </div>
              </div>
              <button type="submit" className="pass-save-btn" disabled={savingPass || !curPass || !newPass}>
                {savingPass ? 'Cambiando...' : 'Cambiar contraseña'}
              </button>
            </form>
          </>
        )}

        {tab === 'team' && (
          <>
            {migrationNeeded && (
              <div style={{ background:'rgba(217,119,6,0.09)', border:'1px solid rgba(217,119,6,0.22)', borderRadius:'var(--r-md,16px)', padding:'14px 18px', marginBottom:16, fontSize:13, fontWeight:600, color:'#92400e', lineHeight:1.5 }}>
                ⚠️ Ejecuta la migración <strong>003_team_management.sql</strong> en Supabase → SQL Editor para activar esta sección.
              </div>
            )}
            <div className="section-hd">
              <div className="sec-title">{memberList.length} miembro{memberList.length !== 1 ? 's' : ''}</div>
              {canManage && (
                <button className="invite-btn" onClick={() => { setShowInvite(true); setInvMsg(null) }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span className="invite-btn-lbl">Invitar</span>
                </button>
              )}
            </div>
            <div className="card">
              {memberList.length === 0 && <div className="empty">No hay miembros aún.</div>}
              {memberList.map(m => {
                const rm = ROLE_META[m.role] ?? ROLE_META.staff
                const isMe = m.id === myUserId
                const canEdit = canManage && !isMe && m.role !== 'owner'
                return (
                  <div key={m.id} className="member-row">
                    <div className="av-sm">{initials(m.full_name)}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="member-name">{m.full_name}{isMe ? ' (tú)' : ''}</div>
                      <div className="modules-chip">{MODULES[m.role]?.map(mod => <span key={mod} className="mod">{mod}</span>)}</div>
                    </div>
                    <div className="member-right">
                      {canEdit
                        ? <select className="role-select badge" style={{ background:rm.bg, color:rm.color }} value={m.role} disabled={updatingId === m.id} onChange={e => changeRole(m.id, e.target.value)}>
                            {Object.entries(ROLE_META).filter(([k]) => k !== 'owner').map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        : <span className="badge" style={{ background:rm.bg, color:rm.color }}>{rm.label}</span>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
            {invList.length > 0 && (
              <>
                <div className="section-hd" style={{ marginTop:8 }}>
                  <div className="sec-title">Invitaciones pendientes ({invList.length})</div>
                </div>
                <div className="card">
                  {invList.map(inv => {
                    const rm = ROLE_META[inv.role] ?? ROLE_META.staff
                    return (
                      <div key={inv.id} className="member-row">
                        <div className="av-sm invited">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div className="member-name" style={{ fontSize:13 }}>{inv.email}</div>
                          <div className="member-sub">Enviado hace {timeAgo(inv.created_at)} · expira en {Math.max(0,Math.ceil((new Date(inv.expires_at).getTime()-Date.now())/86400000))}d</div>
                        </div>
                        <div className="member-right">
                          <span className="badge" style={{ background:rm.bg, color:rm.color }}>{rm.label}</span>
                          <span className="inv-tag">Pendiente</span>
                          {canManage && <button className="cancel-btn" disabled={updatingId === inv.id} onClick={() => cancelInvitation(inv.id)} title="Cancelar">×</button>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            <div className="section-hd" style={{ marginTop:8 }}>
              <div className="sec-title">Roles y accesos</div>
            </div>
            <div className="card">
              {Object.entries(ROLE_META).map(([key, rm]) => (
                <div key={key} className="member-row" style={{ alignItems:'flex-start', gap:14 }}>
                  <span className="badge" style={{ background:rm.bg, color:rm.color, marginTop:2 }}>{rm.label}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text-2,#1A1A20)' }}>{rm.desc}</div>
                    <div className="modules-chip" style={{ marginTop:5 }}>{MODULES[key]?.map(mod => <span key={mod} className="mod">{mod}</span>)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showInvite && (
        <div className="modal-scrim" onClick={e => { if (e.target === e.currentTarget) setShowInvite(false) }}>
          <div className="modal">
            <div className="modal-title">Invitar al equipo</div>
            <div className="modal-sub">El usuario recibirá un correo para unirse a {orgName}.</div>
            {invMsg && <div className={invMsg.type === 'ok' ? 'alert-ok' : 'alert-err'}>{invMsg.text}</div>}
            <form onSubmit={handleInvite}>
              <div className="name-row">
                <div>
                  <div className="fl">Nombre *</div>
                  <input className="mfi" style={{ marginBottom:0 }} type="text" placeholder="Juan" value={invFirstName} onChange={e => setInvFirstName(e.target.value)} autoFocus required />
                </div>
                <div>
                  <div className="fl">Apellido</div>
                  <input className="mfi" style={{ marginBottom:0 }} type="text" placeholder="García" value={invLastName} onChange={e => setInvLastName(e.target.value)} />
                </div>
              </div>
              <div className="fl" style={{ marginTop:14 }}>Correo electrónico *</div>
              <input className="mfi" type="email" placeholder="nombre@ejemplo.com" value={invEmail} onChange={e => setInvEmail(e.target.value)} required />
              <div className="fl">Rol</div>
              <div className="role-pills">
                {(['admin','staff','viewer'] as const).map(r => (
                  <button key={r} type="button" className={`rpill${invRole===r?' on':''}`} onClick={() => setInvRole(r)}>
                    {ROLE_META[r].label}
                    <span className="rpill-desc">{ROLE_META[r].desc}</span>
                  </button>
                ))}
              </div>
              <div className="modules-preview">
                <div className="modules-preview-title">Módulos con acceso</div>
                <div className="mod-list">{MODULES[invRole]?.map(mod => <span key={mod} className="mod">{mod}</span>)}</div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowInvite(false)}>Cancelar</button>
                <button type="submit" className="btn-send" disabled={sending}>{sending ? 'Enviando...' : 'Enviar invitación'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
