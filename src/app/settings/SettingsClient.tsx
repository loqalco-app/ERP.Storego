'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

interface Member     { id: string; full_name: string; avatar_url: string | null; role: string; status: string; created_at: string; allowed_modules: string[] | null }
interface Invitation { id: string; email: string; role: string; status: string; created_at: string; expires_at: string }

// Nav keys → display labels (single source of truth, used in Sidebar + here)
const MODULE_LIST = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'pos',       label: 'POS' },
  { key: 'finanzas',  label: 'Finanzas' },
  { key: 'orders',    label: 'Órdenes' },
  { key: 'catalog',   label: 'Inventario' },
  { key: 'store',     label: 'Tienda web' },
  { key: 'customers', label: 'Clientes' },
] as const

const DEFAULT_MODULES: Record<string, string[]> = {
  owner:  ['dashboard','pos','finanzas','orders','catalog','store','customers'],
  admin:  ['dashboard','pos','finanzas','orders','catalog','store','customers'],
  staff:  ['dashboard','pos','orders','catalog','customers'],
  viewer: ['dashboard'],
}

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
  const [invMode, setInvMode]       = useState<'direct'|'link'>('direct')
  const [invStep, setInvStep]       = useState<'form'|'link'>('form')
  const [invFirstName, setInvFirstName] = useState('')
  const [invLastName,  setInvLastName]  = useState('')
  const [invEmail, setInvEmail]     = useState('')
  const [invRole,  setInvRole]      = useState('staff')
  const [invPassword, setInvPassword]   = useState('')
  const [showInvPw, setShowInvPw]       = useState(false)
  const [sending,  setSending]      = useState(false)
  const [invMsg,   setInvMsg]       = useState<{ type:'ok'|'err'; text:string }|null>(null)
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied]         = useState(false)
  const [regenId,    setRegenId]    = useState<string|null>(null)
  const [regenEmail, setRegenEmail] = useState('')
  const [regenLink,  setRegenLink]  = useState('')
  const [regenCopied, setRegenCopied] = useState(false)
  const [regenError, setRegenError] = useState('')

  /* Editar miembro */
  const [editMember,  setEditMember]  = useState<Member|null>(null)
  const [editName,    setEditName]    = useState('')
  const [editRole,    setEditRole]    = useState('staff')
  const [editModules, setEditModules] = useState<string[]>([])
  const [editSaving,  setEditSaving]  = useState(false)
  const [editMsg,     setEditMsg]     = useState<{ type:'ok'|'err'; text:string }|null>(null)

  /* Eliminar miembro */
  const [deleteMember,   setDeleteMember]   = useState<Member|null>(null)
  const [deleteLoading,  setDeleteLoading]  = useState(false)
  const [deleteError,    setDeleteError]    = useState('')

  /* Restablecer contraseña */
  const [resetMember,  setResetMember]  = useState<Member|null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetLink,    setResetLink]    = useState('')
  const [resetCopied,  setResetCopied]  = useState(false)
  const [resetError,   setResetError]   = useState('')

  const canManage = ['owner','admin'].includes(myRole)

  function openInviteModal() { setShowInvite(true); setInvStep('form'); setInvMsg(null); setGeneratedLink(''); setCopied(false); setInvPassword('') }
  function closeInviteModal() {
    setShowInvite(false); setInvStep('form'); setGeneratedLink(''); setCopied(false)
    setInvMsg(null); setInvFirstName(''); setInvLastName(''); setInvEmail(''); setInvRole('staff'); setInvPassword('')
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(generatedLink); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { /* ignore */ }
  }

  // Escape cierra cualquier modal abierto
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (editMember)   { closeEdit(); return }
      if (deleteMember) { setDeleteMember(null); setDeleteError(''); return }
      if (resetMember)  { closeReset(); return }
      closeInviteModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editMember, deleteMember, resetMember])

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

  async function handleDirectCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!invEmail.trim() || !invFirstName.trim() || !invPassword) return
    setSending(true); setInvMsg(null)
    const fullName2 = `${invFirstName.trim()} ${invLastName.trim()}`.trim()
    const res = await fetch('/api/team/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: invEmail.trim(), role: invRole, orgId, fullName: fullName2, password: invPassword }),
    })
    const data = await res.json()
    setSending(false)
    if (!res.ok) { setInvMsg({ type:'err', text: data.error ?? 'Error al crear usuario' }); return }
    setMemberList(prev => [{ id: Date.now().toString(), full_name: fullName2, avatar_url: null, role: invRole, status:'active', created_at: new Date().toISOString(), allowed_modules: null }, ...prev])
    setInvMsg({ type:'ok', text: `Usuario creado. ${fullName2} puede entrar con su correo y la contraseña temporal.` })
    setTimeout(() => { closeInviteModal(); router.refresh() }, 2200)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!invEmail.trim() || !invFirstName.trim()) return
    setSending(true); setInvMsg(null)
    const fullName2 = `${invFirstName.trim()} ${invLastName.trim()}`.trim()
    const emailVal = invEmail.trim()
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailVal, role: invRole, orgId, fullName: fullName2 }),
    })
    const data = await res.json()
    setSending(false)
    if (!res.ok) { setInvMsg({ type:'err', text: data.error ?? 'Error al generar acceso' }); return }
    setGeneratedLink(data.link)
    setInvList(prev => [{ id: Date.now().toString(), email: emailVal, role: invRole, status:'pending', created_at: new Date().toISOString(), expires_at: new Date(Date.now()+7*86400000).toISOString() }, ...prev])
    setInvStep('link')
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

  async function getInviteLink(inv: Invitation) {
    setRegenId(inv.id); setRegenEmail(inv.email); setRegenLink(''); setRegenCopied(false); setRegenError('')
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inv.email, role: inv.role, orgId, regenerate: true }),
      })
      const data = await res.json()
      setRegenId(null)
      if (res.ok) setRegenLink(data.link)
      else setRegenError(data.error ?? 'Error al generar el link')
    } catch {
      setRegenId(null)
      setRegenError('Error de red al generar el link')
    }
  }

  async function changeRole(memberId: string, newRole: string) {
    setUpdatingId(memberId)
    const supabase = createClient()
    const { error } = await supabase.from('user_profiles').update({ role: newRole }).eq('id', memberId).eq('organization_id', orgId)
    if (!error) setMemberList(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    setUpdatingId(null)
  }

  function openEdit(m: Member) {
    setEditMember(m)
    setEditName(m.full_name)
    setEditRole(m.role)
    setEditModules(m.allowed_modules ?? DEFAULT_MODULES[m.role] ?? ['dashboard'])
    setEditMsg(null)
  }
  function closeEdit() { setEditMember(null); setEditMsg(null) }

  function toggleModule(key: string) {
    setEditModules(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  // When role changes in edit modal, reset modules to role defaults
  function handleEditRoleChange(r: string) {
    setEditRole(r)
    setEditModules(DEFAULT_MODULES[r] ?? ['dashboard'])
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editMember || !editName.trim()) return
    setEditSaving(true); setEditMsg(null)
    // Send null if modules match role defaults (no override needed)
    const defaults = DEFAULT_MODULES[editRole] ?? ['dashboard']
    const isDefault = editModules.length === defaults.length && defaults.every(k => editModules.includes(k))
    const allowedModules = isDefault ? null : editModules
    const res = await fetch('/api/team/member', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: editMember.id, fullName: editName.trim(), role: editRole, allowedModules, orgId }),
    })
    const data = await res.json()
    setEditSaving(false)
    if (!res.ok) { setEditMsg({ type:'err', text: data.error ?? 'Error al guardar.' }); return }
    setMemberList(prev => prev.map(m => m.id === editMember.id
      ? { ...m, full_name: editName.trim(), role: editRole, allowed_modules: allowedModules }
      : m
    ))
    closeEdit()
  }

  async function handleDelete() {
    if (!deleteMember) return
    setDeleteLoading(true); setDeleteError('')
    const res = await fetch('/api/team/member', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: deleteMember.id, orgId }),
    })
    const data = await res.json()
    setDeleteLoading(false)
    if (!res.ok) { setDeleteError(data.error ?? 'Error al eliminar.'); return }
    setMemberList(prev => prev.filter(m => m.id !== deleteMember.id))
    setDeleteMember(null)
  }

  async function handleResetPassword(m: Member) {
    setResetMember(m); setResetLink(''); setResetCopied(false); setResetError('')
    setResetLoading(true)
    const res = await fetch('/api/team/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: m.id, orgId }),
    })
    const data = await res.json()
    setResetLoading(false)
    if (!res.ok) { setResetError(data.error ?? 'Error al generar el link.'); return }
    setResetLink(data.link)
  }
  function closeReset() { setResetMember(null); setResetLink(''); setResetError('') }

  const EyeIcon = ({ show }: { show: boolean }) => show
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:var(--font,'Inter',-apple-system,sans-serif);-webkit-font-smoothing:antialiased}
        .content{max-width:640px;margin:0 auto;width:100%}
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
        .link-btn{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:var(--r-pill,50px);border:1.5px solid var(--border,rgba(0,0,0,0.10));background:none;font-size:11px;font-weight:700;color:var(--brand,#1D4ED8);cursor:pointer;font-family:inherit;transition:background 0.12s;white-space:nowrap;flex-shrink:0}
        .link-btn:hover{background:rgba(29,78,216,0.07)}
        .link-btn:disabled{opacity:0.4;cursor:default}
        .regen-panel{padding:10px 18px 14px;background:rgba(0,0,0,0.025);border-top:1px solid rgba(0,0,0,0.05)}
        .regen-box{background:rgba(0,0,0,0.04);border:1.5px solid rgba(0,0,0,0.08);border-radius:10px;padding:9px 12px;margin-bottom:8px;word-break:break-all;font-size:11px;font-weight:500;color:var(--text-2,#374151);line-height:1.5;font-family:monospace;max-height:60px;overflow-y:auto}
        .copy-sm-btn{width:100%;padding:9px;border-radius:10px;border:none;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;transition:all 0.15s}
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
        .mode-tabs{display:flex;gap:6px;margin-bottom:16px;background:rgba(0,0,0,0.04);border-radius:14px;padding:4px}
        .mode-tab{flex:1;padding:9px 8px;border-radius:10px;border:none;background:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.50);transition:all .15s;text-align:center}
        .mode-tab.on{background:var(--bg,#ECEEF2);color:var(--text-1,#1A1A20);box-shadow:0 1px 4px rgba(0,0,0,0.10)}
        .pw-wrap{position:relative;margin-bottom:14px}
        .pw-eye{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:rgba(10,10,14,0.38);padding:4px;display:flex;align-items:center}
        .member-actions{display:flex;align-items:center;gap:6px;margin-left:8px}
        .mem-act-btn{width:30px;height:30px;border-radius:50%;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.12s;flex-shrink:0}
        .mem-act-btn:disabled{opacity:0.4;cursor:default}
        .mem-act-edit{background:rgba(0,0,0,0.06);color:var(--text-2,#374151)}
        .mem-act-edit:hover{background:rgba(0,0,0,0.12)}
        .mem-act-key{background:rgba(217,119,6,0.10);color:#D97706}
        .mem-act-key:hover{background:rgba(217,119,6,0.18)}
        .mem-act-del{background:rgba(220,38,38,0.08);color:#DC2626}
        .mem-act-del:hover{background:rgba(220,38,38,0.15)}
        .confirm-modal{background:var(--bg,#ECEEF2);border-radius:var(--r-2xl,28px);padding:28px 24px;width:100%;max-width:400px;box-shadow:var(--shadow-float);margin:0 8px 8px}
        .confirm-title{font-size:18px;font-weight:800;color:var(--text-1);margin-bottom:8px;letter-spacing:-0.3px}
        .confirm-sub{font-size:14px;color:var(--text-3);margin-bottom:24px;line-height:1.5}
        .confirm-actions{display:flex;gap:10px}
        .btn-danger{flex:2;padding:14px;border-radius:var(--r-xl,24px);border:none;background:linear-gradient(145deg,#DC2626,#EF4444);font-size:15px;font-weight:700;color:white;cursor:pointer;font-family:inherit;transition:opacity 0.15s}
        .btn-danger:hover{opacity:.90}
        .btn-danger:disabled{opacity:.5;cursor:not-allowed}
        .reset-modal{background:var(--bg,#ECEEF2);border-radius:var(--r-2xl,28px);padding:28px 24px;width:100%;max-width:480px;box-shadow:var(--shadow-float);margin:0 8px 8px}
      `}</style>

      <Sidebar active="settings" />

      <div className="content">
        <div className="page-hd">
          <div className="page-hd-row">
            <div className="page-title">Ajustes</div>
          </div>
          <div className="page-hd-tabs">
            <button className={`page-hd-tab${tab === 'profile' ? ' on' : ''}`} onClick={() => switchTab('profile')}>Mi perfil</button>
            <button className={`page-hd-tab${tab === 'team' ? ' on' : ''}`} onClick={() => switchTab('team')}>Equipo</button>
          </div>
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
                <button className="invite-btn" onClick={openInviteModal}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span className="invite-btn-lbl">Agregar</span>
                </button>
              )}
            </div>
            {memberList.length === 0 && <div className="empty">No hay miembros aún.</div>}
            {memberList.map(m => {
              const rm = ROLE_META[m.role] ?? ROLE_META.staff
              const isMe = m.id === myUserId
              const canAct = canManage && !isMe && m.role !== 'owner'
              return (
                <div key={m.id} className="card" style={{ marginBottom:10 }}>
                  <div className="member-row" style={{ borderTop:'none' }}>
                    <div className="av-sm">{initials(m.full_name)}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <div className="member-name">{m.full_name}{isMe ? ' (tú)' : ''}</div>
                        <span className="badge" style={{ background:rm.bg, color:rm.color }}>{rm.label}</span>
                      </div>
                      <div className="modules-chip" style={{ marginTop:6 }}>
                        {MODULE_LIST
                          .filter(mod => (m.allowed_modules ?? DEFAULT_MODULES[m.role] ?? []).includes(mod.key))
                          .map(mod => <span key={mod.key} className="mod">{mod.label}</span>)
                        }
                      </div>
                    </div>
                    {canAct && (
                      <div className="member-actions">
                        <button className="mem-act-btn mem-act-edit" title="Editar" onClick={() => openEdit(m)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="mem-act-btn mem-act-key" title="Restablecer contraseña" onClick={() => handleResetPassword(m)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        </button>
                        <button className="mem-act-btn mem-act-del" title="Eliminar usuario" onClick={() => { setDeleteMember(m); setDeleteError('') }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {invList.length > 0 && (
              <>
                <div className="section-hd" style={{ marginTop:8 }}>
                  <div className="sec-title">Invitaciones pendientes ({invList.length})</div>
                </div>
                <div className="card">
                  {invList.map(inv => {
                    const rm = ROLE_META[inv.role] ?? ROLE_META.staff
                    const showPanel = regenLink && regenEmail === inv.email
                    return (
                      <div key={inv.id}>
                        <div className="member-row">
                          <div className="av-sm invited">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div className="member-name" style={{ fontSize:13 }}>{inv.email}</div>
                            <div className="member-sub">Hace {timeAgo(inv.created_at)} · expira en {Math.max(0,Math.ceil((new Date(inv.expires_at).getTime()-Date.now())/86400000))}d</div>
                          </div>
                          <div className="member-right">
                            <span className="badge" style={{ background:rm.bg, color:rm.color }}>{rm.label}</span>
                            {canManage && (
                              <button
                                className="link-btn"
                                disabled={regenId === inv.id}
                                onClick={() => { setRegenLink(''); setRegenCopied(false); getInviteLink(inv) }}
                                title="Ver link de acceso"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                {regenId === inv.id ? 'Generando…' : 'Ver link'}
                              </button>
                            )}
                            {canManage && <button className="cancel-btn" disabled={updatingId === inv.id} onClick={() => { setRegenLink(''); setRegenError(''); cancelInvitation(inv.id) }} title="Cancelar">×</button>}
                          </div>
                        </div>
                        {regenError && regenEmail === inv.email && (
                          <div className="regen-panel" style={{ color:'#991b1b', fontSize:12, fontWeight:600 }}>{regenError}</div>
                        )}
                        {showPanel && (
                          <div className="regen-panel">
                            <div className="regen-box">{regenLink}</div>
                            <button
                              className="copy-sm-btn"
                              onClick={async () => {
                                try { await navigator.clipboard.writeText(regenLink); setRegenCopied(true); setTimeout(() => setRegenCopied(false), 2500) } catch { /* ignore */ }
                              }}
                              style={{
                                background: regenCopied ? 'rgba(5,150,105,0.12)' : 'linear-gradient(145deg,#1D4ED8,#2563EB)',
                                color: regenCopied ? '#065f46' : 'white',
                                boxShadow: regenCopied ? 'none' : '0 3px 10px rgba(29,78,216,0.25)',
                              }}
                            >
                              {regenCopied ? '✓ ¡Copiado!' : 'Copiar link'}
                            </button>
                          </div>
                        )}
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
                    <div className="modules-chip" style={{ marginTop:5 }}>
                    {MODULE_LIST
                      .filter(mod => (DEFAULT_MODULES[key] ?? []).includes(mod.key))
                      .map(mod => <span key={mod.key} className="mod">{mod.label}</span>)
                    }
                  </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Edit member modal ── */}
      {editMember && (
        <div className="modal-scrim" onClick={e => { if (e.target === e.currentTarget) closeEdit() }}>
          <div className="modal">
            <div className="modal-title">Editar miembro</div>
            <div className="modal-sub" style={{ marginBottom:20 }}>Cambia el nombre o el rol de {editMember.full_name}.</div>
            {editMsg && <div className={editMsg.type === 'ok' ? 'alert-ok' : 'alert-err'} style={{ marginBottom:14 }}>{editMsg.text}</div>}
            <form onSubmit={handleEditSave}>
              <div className="fl">Nombre completo *</div>
              <input className="mfi" type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nombre completo" required />
              <div className="fl">Rol</div>
              <div className="role-pills" style={{ marginBottom:16 }}>
                {(['admin','staff','viewer'] as const).map(r => (
                  <button key={r} type="button" className={`rpill${editRole===r?' on':''}`} onClick={() => handleEditRoleChange(r)}>
                    {ROLE_META[r].label}
                    <span className="rpill-desc">{ROLE_META[r].desc}</span>
                  </button>
                ))}
              </div>
              <div className="fl" style={{ marginBottom:10 }}>Secciones con acceso</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
                {MODULE_LIST.map(mod => {
                  const checked = editModules.includes(mod.key)
                  return (
                    <button
                      key={mod.key}
                      type="button"
                      onClick={() => toggleModule(mod.key)}
                      style={{
                        display:'flex', alignItems:'center', gap:8,
                        padding:'10px 12px', borderRadius:12,
                        border: checked ? '1.5px solid #1D4ED8' : '1.5px solid rgba(0,0,0,0.08)',
                        background: checked ? 'rgba(29,78,216,0.08)' : 'rgba(0,0,0,0.025)',
                        cursor:'pointer', fontFamily:'inherit', textAlign:'left', transition:'all .12s',
                      }}
                    >
                      <div style={{
                        width:18, height:18, borderRadius:5, border: checked ? '2px solid #1D4ED8' : '2px solid rgba(0,0,0,0.20)',
                        background: checked ? '#1D4ED8' : 'transparent',
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .12s',
                      }}>
                        {checked && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color: checked ? '#1D4ED8' : 'var(--text-2,#374151)' }}>{mod.label}</span>
                    </button>
                  )
                })}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeEdit}>Cancelar</button>
                <button type="submit" className="btn-send" disabled={editSaving || !editName.trim() || editModules.length === 0}>
                  {editSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteMember && (
        <div className="modal-scrim" onClick={e => { if (e.target === e.currentTarget) { setDeleteMember(null); setDeleteError('') } }}>
          <div className="confirm-modal">
            <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(220,38,38,0.10)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </div>
            <div className="confirm-title">Eliminar usuario</div>
            <div className="confirm-sub">
              ¿Estás seguro de eliminar a <strong>{deleteMember.full_name}</strong>? Perderá acceso inmediatamente y no podrá recuperar su cuenta.
            </div>
            {deleteError && <div className="alert-err" style={{ marginBottom:16 }}>{deleteError}</div>}
            <div className="confirm-actions">
              <button type="button" className="btn-cancel" style={{ flex:1 }} onClick={() => { setDeleteMember(null); setDeleteError('') }}>Cancelar</button>
              <button type="button" className="btn-danger" disabled={deleteLoading} onClick={handleDelete}>
                {deleteLoading ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset password modal ── */}
      {resetMember && (
        <div className="modal-scrim" onClick={e => { if (e.target === e.currentTarget) closeReset() }}>
          <div className="reset-modal">
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(217,119,6,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div>
                <div className="modal-title" style={{ margin:0 }}>Restablecer contraseña</div>
                <div style={{ fontSize:13, color:'var(--text-3)', marginTop:2 }}>{resetMember.full_name}</div>
              </div>
            </div>

            {resetLoading && (
              <div style={{ textAlign:'center', padding:'20px 0', fontSize:14, color:'var(--text-3)', fontWeight:600 }}>Generando link seguro...</div>
            )}

            {!resetLoading && resetError && (
              <div className="alert-err" style={{ marginBottom:16 }}>{resetError}</div>
            )}

            {!resetLoading && resetLink && (
              <>
                <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:12, lineHeight:1.5 }}>
                  Copia este link y mándalo por WhatsApp a <strong>{resetMember.full_name}</strong>. Solo funciona una vez y expira en 24 horas.
                </div>
                <div style={{ background:'rgba(0,0,0,0.04)', border:'1.5px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'12px 14px', marginBottom:12, wordBreak:'break-all', fontSize:11, fontWeight:500, color:'var(--text-2)', lineHeight:1.5, fontFamily:'monospace', maxHeight:80, overflowY:'auto' }}>
                  {resetLink}
                </div>
                <button
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(resetLink); setResetCopied(true); setTimeout(() => setResetCopied(false), 2500) } catch { /* ignore */ }
                  }}
                  style={{ width:'100%', padding:'13px', borderRadius:14, border:'none', marginBottom:10, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:700, transition:'all 0.15s',
                    background: resetCopied ? 'rgba(5,150,105,0.12)' : 'linear-gradient(145deg,#1D4ED8,#2563EB)',
                    color: resetCopied ? '#065f46' : 'white',
                    boxShadow: resetCopied ? 'none' : '0 4px 14px rgba(29,78,216,0.28)',
                  }}
                >
                  {resetCopied ? '✓ ¡Copiado!' : 'Copiar link'}
                </button>
              </>
            )}

            <button className="btn-cancel" style={{ width:'100%', padding:'13px', borderRadius:14 }} onClick={closeReset}>
              {resetLink ? 'Listo' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}

      {showInvite && (
        <div className="modal-scrim" onClick={e => { if (e.target === e.currentTarget) closeInviteModal() }}>
          <div className="modal">
            {invStep === 'form' ? (
              <>
                <div className="modal-title">Agregar al equipo</div>
                <div className="mode-tabs">
                  <button type="button" className={`mode-tab${invMode==='direct'?' on':''}`} onClick={() => setInvMode('direct')}>Con contraseña</button>
                  <button type="button" className={`mode-tab${invMode==='link'?' on':''}`} onClick={() => setInvMode('link')}>Enviar link</button>
                </div>
                <div className="modal-sub">
                  {invMode === 'direct'
                    ? 'Crea el usuario con contraseña temporal — al entrar por primera vez se le pedirá cambiarla.'
                    : 'Genera un link de un solo uso para mandar por WhatsApp.'}
                </div>
                {invMsg && <div className={invMsg.type === 'ok' ? 'alert-ok' : 'alert-err'}>{invMsg.text}</div>}
                <form onSubmit={invMode === 'direct' ? handleDirectCreate : handleInvite}>
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
                  {invMode === 'direct' && (
                    <>
                      <div className="fl">Contraseña temporal *</div>
                      <div className="pw-wrap">
                        <input className="mfi" style={{marginBottom:0,paddingRight:44}} type={showInvPw ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={invPassword} onChange={e => setInvPassword(e.target.value)} required minLength={8} />
                        <button type="button" className="pw-eye" onClick={() => setShowInvPw(v => !v)}>
                          {showInvPw
                            ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          }
                        </button>
                      </div>
                    </>
                  )}
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
                      {MODULE_LIST.filter(mod => (DEFAULT_MODULES[invRole] ?? []).includes(mod.key)).map(mod => <span key={mod.key} className="mod">{mod.label}</span>)}
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn-cancel" onClick={closeInviteModal}>Cancelar</button>
                    <button type="submit" className="btn-send" disabled={sending}>
                      {sending ? (invMode==='direct' ? 'Creando...' : 'Generando...') : (invMode==='direct' ? 'Crear usuario' : 'Generar link')}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(5,150,105,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div className="modal-title" style={{margin:0}}>Acceso generado</div>
                </div>
                <div className="modal-sub" style={{marginBottom:20}}>
                  Copia este link y mándalo por WhatsApp a <strong>{invEmail}</strong>. Solo funciona una vez.
                </div>
                <div style={{background:'rgba(0,0,0,0.04)',border:'1.5px solid rgba(0,0,0,0.08)',borderRadius:14,padding:'12px 14px',marginBottom:12,wordBreak:'break-all',fontSize:12,fontWeight:500,color:'var(--text-2,#374151)',lineHeight:1.5,fontFamily:'monospace',maxHeight:80,overflowY:'auto'}}>
                  {generatedLink}
                </div>
                <button
                  onClick={copyLink}
                  style={{width:'100%',padding:'13px',borderRadius:14,border:'none',marginBottom:10,cursor:'pointer',fontFamily:'inherit',fontSize:14,fontWeight:700,transition:'all 0.15s',
                    background: copied ? 'rgba(5,150,105,0.12)' : 'linear-gradient(145deg,#1D4ED8,#2563EB)',
                    color: copied ? '#065f46' : 'white',
                    boxShadow: copied ? 'none' : '0 4px 14px rgba(29,78,216,0.28)',
                  }}
                >
                  {copied ? '✓ ¡Copiado!' : <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copiar link
                  </span>}
                </button>
                <button className="btn-cancel" style={{width:'100%',padding:'13px',borderRadius:14}} onClick={closeInviteModal}>Listo</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
