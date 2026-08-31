'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

interface Props {
  mode: 'create' | 'edit'; orgId: string; userId: string; userName: string; orgName: string
  customerId?: string
  initial?: { fullName: string; email: string; phone: string; taxId: string; notes: string; status: string; creditLimit: string }
}

export default function CustomerForm({ mode, orgId, userId, orgName, userName, customerId, initial }: Props) {
  const router = useRouter()
  const [fullName, setFullName]       = useState(initial?.fullName ?? '')
  const [email, setEmail]             = useState(initial?.email ?? '')
  const [phone, setPhone]             = useState(initial?.phone ?? '')
  const [taxId, setTaxId]             = useState(initial?.taxId ?? '')
  const [notes, setNotes]             = useState(initial?.notes ?? '')
  const [status, setStatus]           = useState(initial?.status ?? 'active')
  const [creditLimit, setCreditLimit] = useState(initial?.creditLimit ?? '0')
  const [saving, setSaving]           = useState(false)
  const [err, setErr]                 = useState<string | null>(null)
  const [deleting, setDeleting]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { setErr('El nombre es obligatorio.'); return }
    setSaving(true); setErr(null)
    const supabase = createClient()
    const payload = { full_name: fullName.trim(), email: email.trim()||null, phone: phone.trim()||null, tax_id: taxId.trim()||null, notes: notes.trim()||null, status, credit_limit: parseFloat(creditLimit)||0 }
    if (mode === 'create') {
      const { error } = await supabase.from('customers').insert({ ...payload, organization_id: orgId, created_by: userId })
      if (error) { setSaving(false); setErr(error.message); return }
    } else {
      const { error } = await supabase.from('customers').update(payload).eq('id', customerId)
      if (error) { setSaving(false); setErr(error.message); return }
    }
    router.push('/customers')
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    setDeleting(true)
    await createClient().from('customers').delete().eq('id', customerId)
    router.push('/customers')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:var(--font,'Inter',-apple-system,sans-serif);-webkit-font-smoothing:antialiased}
        .topbar{padding-bottom:20px}
        .back-btn{width:38px;height:38px;border-radius:var(--r-sm,12px);background:var(--bg,#ECEEF2);display:flex;align-items:center;justify-content:center;text-decoration:none;flex-shrink:0;box-shadow:var(--shadow-sm)}
        .page-title{font-size:22px;font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-0.4px;flex:1}
        @media(min-width:768px){.page-title{font-size:var(--text-xl,26px)}}
        .del-btn{padding:9px 14px;border-radius:var(--r-sm,12px);border:none;background:rgba(220,38,38,0.08);color:#DC2626;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 0.12s}
        .del-btn:hover{background:rgba(220,38,38,0.14)}
        .content{padding:0 20px calc(var(--nav-h,88px) + 16px)}
        @media(min-width:768px){.content{padding:0 40px calc(var(--nav-h,88px) + 16px);max-width:680px;margin:0 auto}}
        .sec-title{font-size:var(--text-md,17px);font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-0.3px;margin:20px 0 10px}
        .card{background:var(--bg,#ECEEF2);border-radius:var(--r-xl,24px);overflow:hidden;box-shadow:var(--shadow-card);margin-bottom:16px}
        .field{padding:14px 20px;border-top:1px solid var(--border-light,rgba(0,0,0,0.04))}
        .field:first-child{border-top:none}
        .fl{font-size:11px;font-weight:700;color:var(--text-4,rgba(26,26,32,0.35));text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
        .fi,.fta{width:100%;padding:13px 16px;background:rgba(0,0,0,0.03);border:1.5px solid var(--border,rgba(0,0,0,0.07));border-radius:var(--r-md,16px);font-size:15px;font-weight:500;color:var(--text-1,#1A1A20);font-family:inherit;outline:none;box-shadow:var(--shadow-inset);transition:border-color 0.15s}
        .fi:focus,.fta:focus{border-color:var(--brand-mid,#2563EB);box-shadow:var(--shadow-inset),0 0 0 3px var(--brand-alpha,rgba(37,99,235,0.12))}
        .fta{resize:vertical;min-height:80px}
        .seg{display:flex;gap:8px}
        .seg-btn{flex:1;padding:11px 8px;border-radius:var(--r-sm,12px);border:1.5px solid var(--border,rgba(0,0,0,0.08));background:var(--bg,#ECEEF2);font-size:13px;font-weight:600;color:var(--text-3,rgba(26,26,32,0.45));cursor:pointer;font-family:inherit;transition:all 0.15s}
        .seg-btn.on{background:var(--brand,#1D4ED8);color:white;border-color:var(--brand,#1D4ED8);box-shadow:var(--shadow-brand-sm)}
        .seg-btn.danger.on{background:#DC2626;border-color:#DC2626;box-shadow:0 4px 14px rgba(220,38,38,0.25)}
        .alert-e{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:var(--r-md,16px);padding:12px 16px;font-size:13px;font-weight:600;color:#991b1b;margin-bottom:16px}
        .save-btn{width:100%;padding:16px;background:var(--grad-brand-btn,linear-gradient(145deg,#1D4ED8,#2563EB));border:none;border-radius:var(--r-xl,24px);font-size:16px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:var(--shadow-brand);transition:opacity 0.15s,transform 0.12s;margin-top:8px}
        .save-btn:hover{opacity:.92}
        .save-btn:active{transform:scale(0.98)}
        .save-btn:disabled{opacity:.5;cursor:not-allowed}
      `}</style>

      <Sidebar active="customers" />

      <div className="topbar">
        <Link href="/customers" className="back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-1,#1A1A20)" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div className="page-title">{mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</div>
        {mode === 'edit' && <button className="del-btn" onClick={handleDelete} disabled={deleting}>{deleting ? '...' : 'Eliminar'}</button>}
      </div>

      <div className="content">
        {err && <div className="alert-e">{err}</div>}
        <form onSubmit={handleSubmit}>
          <div className="sec-title">Información</div>
          <div className="card">
            <div className="field"><div className="fl">Nombre completo *</div><input className="fi" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ej. María González López" autoFocus autoComplete="name" /></div>
            <div className="field"><div className="fl">Teléfono</div><input className="fi" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+52 55 1234 5678" autoComplete="tel" /></div>
            <div className="field"><div className="fl">Correo electrónico</div><input className="fi" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@ejemplo.com" autoComplete="email" /></div>
            <div className="field"><div className="fl">RFC / ID fiscal (opcional)</div><input className="fi" type="text" value={taxId} onChange={e => setTaxId(e.target.value.toUpperCase())} placeholder="Ej. GOGM901012AB1" autoComplete="off" /></div>
          </div>

          <div className="sec-title">Estado</div>
          <div className="card">
            <div className="field">
              <div className="fl">Estado del cliente</div>
              <div className="seg">
                <button type="button" className={`seg-btn${status==='active'?' on':''}`} onClick={() => setStatus('active')}>Activo</button>
                <button type="button" className={`seg-btn${status==='inactive'?' on':''}`} onClick={() => setStatus('inactive')}>Inactivo</button>
                <button type="button" className={`seg-btn danger${status==='blocked'?' on':''}`} onClick={() => setStatus('blocked')}>Bloqueado</button>
              </div>
            </div>
            <div className="field"><div className="fl">Límite de crédito ($)</div><input className="fi" type="number" min="0" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} placeholder="0.00" /></div>
          </div>

          <div className="sec-title">Notas</div>
          <div className="card">
            <div className="field"><div className="fl">Notas internas</div><textarea className="fta" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Preferencias, historial, notas importantes..." /></div>
          </div>

          <button type="submit" className="save-btn" disabled={saving}>
            {saving ? 'Guardando...' : mode === 'create' ? 'Agregar cliente' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </>
  )
}
