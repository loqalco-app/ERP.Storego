'use client'

import { useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

interface Member {
  id: string; full_name: string; avatar_url: string | null
  role: string; status: string; created_at: string
}
interface Invitation {
  id: string; email: string; role: string; status: string; created_at: string; expires_at: string
}
interface Props {
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

function initials(name: string) {
  return name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?'
}
function timeAgo(dateStr: string) {
  const d = new Date(dateStr); const now = Date.now(); const diff = now - d.getTime()
  if (diff < 60000) return 'ahora'; if (diff < 3600000) return `${Math.floor(diff/60000)}m`
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h`
  return `${Math.floor(diff/86400000)}d`
}

export default function TeamClient({ orgId, orgName, myUserId, myRole, myEmail, members, invitations, migrationNeeded }: Props) {
  const [showInvite, setShowInvite]   = useState(false)
  const [invEmail, setInvEmail]       = useState('')
  const [invRole, setInvRole]         = useState('staff')
  const [sending, setSending]         = useState(false)
  const [invMsg, setInvMsg]           = useState<{ type: 'ok'|'err'; text: string } | null>(null)
  const [memberList, setMemberList]   = useState<Member[]>(members)
  const [invList, setInvList]         = useState<Invitation[]>(invitations)
  const [updatingId, setUpdatingId]   = useState<string|null>(null)

  const canManage = ['owner','admin'].includes(myRole)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!invEmail.trim()) return
    setSending(true); setInvMsg(null)
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: invEmail.trim(), role: invRole, orgId }),
    })
    const data = await res.json()
    if (!res.ok) { setInvMsg({ type: 'err', text: data.error ?? 'Error al enviar invitación' }); setSending(false); return }
    setInvMsg({ type: 'ok', text: data.method === 'email' ? `Invitación enviada a ${invEmail}` : `Invitación creada. Agrega SUPABASE_SERVICE_ROLE_KEY en Vercel para enviar correos automáticos.` })
    setInvEmail(''); setInvRole('staff'); setSending(false)
    setInvList(prev => [{ id: Date.now().toString(), email: invEmail.trim(), role: invRole, status: 'pending', created_at: new Date().toISOString(), expires_at: new Date(Date.now()+7*86400000).toISOString() }, ...prev])
    setTimeout(() => { setShowInvite(false); setInvMsg(null) }, 2500)
  }

  async function cancelInvitation(invId: string) {
    setUpdatingId(invId)
    await fetch('/api/team/invite', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invitationId: invId, orgId }) })
    setInvList(prev => prev.filter(i => i.id !== invId))
    setUpdatingId(null)
  }

  async function changeRole(memberId: string, newRole: string) {
    setUpdatingId(memberId)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error } = await supabase.from('user_profiles').update({ role: newRole }).eq('id', memberId).eq('organization_id', orgId)
    if (!error) setMemberList(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    setUpdatingId(null)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:var(--font,'Inter',-apple-system,sans-serif);-webkit-font-smoothing:antialiased}

        .topbar{display:flex;align-items:center;gap:12px}
        .back-btn{width:38px;height:38px;border-radius:var(--r-sm,12px);background:var(--bg,#ECEEF2);display:flex;align-items:center;justify-content:center;text-decoration:none;flex-shrink:0;box-shadow:var(--shadow-sm)}
        .page-title{font-size:22px;font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-0.4px;flex:1}
        @media(min-width:768px){.page-title{font-size:var(--text-xl,26px)}}

        .content{padding:0 20px calc(var(--nav-h,88px) + 16px)}
        @media(min-width:768px){.content{padding:0 40px calc(var(--nav-h,88px) + 16px);max-width:720px}}

        .section-hd{display:flex;align-items:center;justify-content:space-between;margin:20px 0 10px}
        .section-title{font-size:13px;font-weight:700;color:var(--text-3,rgba(26,26,32,0.40));text-transform:uppercase;letter-spacing:0.07em}
        .invite-btn{display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:var(--grad-brand-btn,linear-gradient(145deg,#1D4ED8,#2563EB));color:white;border:none;border-radius:50%;cursor:pointer;font-family:inherit;box-shadow:var(--shadow-brand-sm);transition:opacity 0.15s,transform 0.12s;flex-shrink:0}
        .invite-btn:hover{opacity:.90}
        .invite-btn:active{transform:scale(0.93)}
        @media(min-width:480px){.invite-btn{width:auto;height:auto;border-radius:var(--r-pill,50px);padding:9px 18px;gap:6px}}
        .invite-btn-lbl{display:none}
        @media(min-width:480px){.invite-btn-lbl{display:inline;font-size:13px;font-weight:700}}

        .card{background:var(--bg,#ECEEF2);border-radius:var(--r-xl,24px);overflow:hidden;box-shadow:var(--shadow-card);margin-bottom:16px}
        .member-row{display:flex;align-items:center;gap:12px;padding:13px 18px;border-top:1px solid var(--border-light,rgba(0,0,0,0.04))}
        .member-row:first-child{border-top:none}
        .av{width:40px;height:40px;border-radius:50%;background:var(--grad-brand,linear-gradient(135deg,#1D4ED8,#3B82F6));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:white;flex-shrink:0}
        .av.invited{background:linear-gradient(135deg,#9CA3AF,#6B7280)}
        .member-name{font-size:14px;font-weight:700;color:var(--text-1,#1A1A20)}
        .member-sub{font-size:12px;color:var(--text-3,rgba(26,26,32,0.40));margin-top:2px}
        .member-right{margin-left:auto;display:flex;align-items:center;gap:10px;flex-shrink:0}

        .badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:var(--r-pill,50px);font-size:11px;font-weight:700}
        .role-select{appearance:none;border:none;border-radius:var(--r-sm,12px);padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity 0.15s}
        .role-select:disabled{opacity:0.5;cursor:default}

        .modules-chip{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
        .mod{padding:2px 8px;border-radius:var(--r-pill,50px);background:rgba(0,0,0,0.05);font-size:10px;font-weight:600;color:var(--text-3,rgba(26,26,32,0.45))}

        .empty{padding:32px;text-align:center;color:var(--text-3,rgba(26,26,32,0.38));font-size:13px;font-weight:500}

        .inv-tag{font-size:11px;font-weight:600;color:#D97706;background:rgba(217,119,6,0.10);padding:2px 8px;border-radius:var(--r-pill,50px)}
        .cancel-btn{width:28px;height:28px;border-radius:50%;border:none;background:rgba(220,38,38,0.08);color:#DC2626;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.12s;flex-shrink:0}
        .cancel-btn:hover{background:rgba(220,38,38,0.15)}
        .cancel-btn:disabled{opacity:0.4;cursor:default}

        /* Invite modal */
        .modal-scrim{position:fixed;inset:0;background:rgba(0,0,0,0.44);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:flex-end;justify-content:center}
        @media(min-width:600px){.modal-scrim{align-items:center}}
        .modal{background:var(--bg,#ECEEF2);border-radius:var(--r-2xl,28px) var(--r-2xl,28px) var(--r-2xl,28px) var(--r-2xl,28px);padding:28px 24px 32px;width:100%;max-width:480px;box-shadow:var(--shadow-float);margin:0 8px}
        .modal-title{font-size:20px;font-weight:800;color:var(--text-1,#1A1A20);margin-bottom:4px;letter-spacing:-0.3px}
        .modal-sub{font-size:13px;color:var(--text-3,rgba(26,26,32,0.40));margin-bottom:24px}
        .fl{font-size:11px;font-weight:700;color:var(--text-4,rgba(26,26,32,0.35));text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
        .fi{width:100%;padding:13px 16px;background:rgba(0,0,0,0.03);border:1.5px solid var(--border,rgba(0,0,0,0.07));border-radius:var(--r-md,16px);font-size:15px;font-weight:500;color:var(--text-1,#1A1A20);font-family:inherit;outline:none;transition:border-color 0.15s;margin-bottom:14px}
        .fi:focus{border-color:var(--brand-mid,#2563EB)}
        .role-pills{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
        .rpill{flex:1;min-width:80px;padding:10px 8px;border-radius:var(--r-md,16px);border:1.5px solid var(--border,rgba(0,0,0,0.08));background:var(--bg,#ECEEF2);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s;text-align:center}
        .rpill.on{border-color:var(--brand,#1D4ED8);background:var(--brand-alpha,rgba(29,78,216,0.10));color:var(--brand,#1D4ED8)}
        .rpill-desc{font-size:10px;font-weight:500;opacity:0.65;display:block;margin-top:2px;line-height:1.3}
        .modules-preview{background:rgba(0,0,0,0.04);border-radius:var(--r-md,16px);padding:10px 14px;margin-bottom:20px}
        .modules-preview-title{font-size:10px;font-weight:700;color:var(--text-4);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
        .mod-list{display:flex;flex-wrap:wrap;gap:5px}
        .alert-ok{background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.18);border-radius:var(--r-md,16px);padding:10px 14px;font-size:13px;font-weight:600;color:#065f46;margin-bottom:14px}
        .alert-err{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:var(--r-md,16px);padding:10px 14px;font-size:13px;font-weight:600;color:#991b1b;margin-bottom:14px}
        .modal-actions{display:flex;gap:10px}
        .btn-cancel{flex:1;padding:14px;border-radius:var(--r-xl,24px);border:1.5px solid var(--border,rgba(0,0,0,0.10));background:transparent;font-size:15px;font-weight:700;color:var(--text-2);cursor:pointer;font-family:inherit;transition:background 0.12s}
        .btn-cancel:hover{background:rgba(0,0,0,0.04)}
        .btn-send{flex:2;padding:14px;border-radius:var(--r-xl,24px);border:none;background:var(--grad-brand-btn,linear-gradient(145deg,#1D4ED8,#2563EB));font-size:15px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:var(--shadow-brand);transition:opacity 0.15s}
        .btn-send:hover{opacity:.92}
        .btn-send:disabled{opacity:.5;cursor:not-allowed}
      `}</style>

      <Sidebar active="settings" />

      <div className="topbar">
        <Link href="/settings/profile" className="back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-1,#1A1A20)" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div className="page-title">Equipo</div>
      </div>

      <div className="content">
        {migrationNeeded && (
          <div style={{ background:'rgba(217,119,6,0.09)', border:'1px solid rgba(217,119,6,0.22)', borderRadius:'var(--r-md,16px)', padding:'14px 18px', marginBottom:'16px', fontSize:'13px', fontWeight:600, color:'#92400e', lineHeight:1.5 }}>
            ⚠️ Ejecuta la migración <strong>003_team_management.sql</strong> en Supabase → SQL Editor para activar esta sección.
          </div>
        )}
        {/* Members */}
        <div className="section-hd">
          <div className="section-title">{memberList.length} miembro{memberList.length !== 1 ? 's' : ''}</div>
          {canManage && (
            <button className="invite-btn" onClick={() => { setShowInvite(true); setInvMsg(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span className="invite-btn-lbl">Invitar</span>
            </button>
          )}
        </div>

        <div className="card">
          {memberList.map(m => {
            const rm = ROLE_META[m.role] ?? ROLE_META.staff
            const isMe = m.id === myUserId
            const canEdit = canManage && !isMe && m.role !== 'owner'
            return (
              <div key={m.id} className="member-row">
                <div className="av">{initials(m.full_name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="member-name">{m.full_name}{isMe ? ' (tú)' : ''}</div>
                  <div className="modules-chip">
                    {MODULES[m.role]?.map(mod => <span key={mod} className="mod">{mod}</span>)}
                  </div>
                </div>
                <div className="member-right">
                  {canEdit ? (
                    <select
                      className="role-select badge"
                      style={{ background: rm.bg, color: rm.color }}
                      value={m.role}
                      disabled={updatingId === m.id}
                      onChange={e => changeRole(m.id, e.target.value)}
                    >
                      {Object.entries(ROLE_META).filter(([k]) => k !== 'owner').map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="badge" style={{ background: rm.bg, color: rm.color }}>{rm.label}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Pending invitations */}
        {invList.length > 0 && (
          <>
            <div className="section-hd" style={{ marginTop: 8 }}>
              <div className="section-title">Invitaciones pendientes ({invList.length})</div>
            </div>
            <div className="card">
              {invList.map(inv => {
                const rm = ROLE_META[inv.role] ?? ROLE_META.staff
                return (
                  <div key={inv.id} className="member-row">
                    <div className="av invited">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="member-name" style={{ fontSize: 13 }}>{inv.email}</div>
                      <div className="member-sub">Enviado hace {timeAgo(inv.created_at)} · expira en {Math.max(0,Math.ceil((new Date(inv.expires_at).getTime()-Date.now())/86400000))}d</div>
                    </div>
                    <div className="member-right">
                      <span className="badge" style={{ background: rm.bg, color: rm.color }}>{rm.label}</span>
                      <span className="inv-tag">Pendiente</span>
                      {canManage && (
                        <button className="cancel-btn" disabled={updatingId === inv.id} onClick={() => cancelInvitation(inv.id)} title="Cancelar invitación">×</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Role legend */}
        <div className="section-hd" style={{ marginTop: 8 }}>
          <div className="section-title">Roles y accesos</div>
        </div>
        <div className="card">
          {Object.entries(ROLE_META).map(([key, rm]) => (
            <div key={key} className="member-row" style={{ alignItems: 'flex-start', gap: 14 }}>
              <span className="badge" style={{ background: rm.bg, color: rm.color, marginTop: 2 }}>{rm.label}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2,#1A1A20)' }}>{rm.desc}</div>
                <div className="modules-chip" style={{ marginTop: 5 }}>
                  {MODULES[key]?.map(mod => <span key={mod} className="mod">{mod}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="modal-scrim" onClick={e => { if (e.target === e.currentTarget) setShowInvite(false) }}>
          <div className="modal">
            <div className="modal-title">Invitar al equipo</div>
            <div className="modal-sub">El usuario recibirá un correo para unirse a {orgName}.</div>

            {invMsg && <div className={invMsg.type === 'ok' ? 'alert-ok' : 'alert-err'}>{invMsg.text}</div>}

            <form onSubmit={handleInvite}>
              <div className="fl">Correo electrónico</div>
              <input className="fi" type="email" placeholder="nombre@ejemplo.com" value={invEmail} onChange={e => setInvEmail(e.target.value)} autoFocus required />

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
                <div className="mod-list">
                  {MODULES[invRole]?.map(mod => <span key={mod} className="mod">{mod}</span>)}
                </div>
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
