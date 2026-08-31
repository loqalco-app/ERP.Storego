'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/client'

interface Brand { id: string; name: string; description: string | null; productCount: number }
interface Props { brands: Brand[]; orgId: string; userName: string; orgName: string }

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function BrandsClient({ brands: initial, orgId, userName, orgName }: Props) {
  const [brands, setBrands]   = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Brand | null>(null)
  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  function openCreate() { setEditing(null); setName(''); setDesc(''); setErr(null); setShowForm(true) }
  function openEdit(b: Brand) { setEditing(b); setName(b.name); setDesc(b.description ?? ''); setErr(null); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditing(null) }

  async function handleSave() {
    if (!name.trim()) { setErr('El nombre es obligatorio.'); return }
    setSaving(true); setErr(null)
    const supabase = createClient()

    if (editing) {
      const { error } = await supabase.from('brands').update({ name: name.trim(), description: desc.trim() || null }).eq('id', editing.id)
      if (error) { setSaving(false); setErr(error.message); return }
      setBrands(bs => bs.map(b => b.id === editing.id ? { ...b, name: name.trim(), description: desc.trim() || null } : b))
    } else {
      const { data, error } = await supabase.from('brands')
        .insert({ organization_id: orgId, name: name.trim(), description: desc.trim() || null, slug: slugify(name.trim()) })
        .select('id, name, description').single()
      if (error) { setSaving(false); setErr(error.message.includes('slug') ? 'Ya existe una marca con ese nombre.' : error.message); return }
      setBrands(bs => [...bs, { ...data, productCount: 0 }])
    }
    setSaving(false); closeForm()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta marca? Los productos quedarán sin marca.')) return
    setDeleting(id)
    await createClient().from('brands').delete().eq('id', id)
    setBrands(bs => bs.filter(b => b.id !== id))
    setDeleting(null)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ECEEF2; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        .shell { display: flex; min-height: 100dvh; }
        .main  { flex: 1; overflow-y: auto; }
        .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 52px 20px 20px; }
        @media (min-width: 768px) { .topbar { padding: 32px 32px 24px; } }
        .page-title { font-size: 26px; font-weight: 800; color: #1A1A20; letter-spacing: -0.5px; }
        .new-btn { display: flex; align-items: center; gap: 7px; background: linear-gradient(145deg,#1D4ED8,#2563EB); color: white; border: none; border-radius: 14px; padding: 11px 18px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; box-shadow: 0 6px 20px rgba(29,78,216,0.28); transition: opacity 0.15s; }
        .new-btn:hover { opacity: 0.90; }
        .content { padding: 0 16px 120px; }
        @media (min-width: 768px) { .content { padding: 0 32px 48px; max-width: 640px; } }
        .card { background: #ECEEF2; border-radius: 24px; overflow: hidden; box-shadow: 6px 6px 18px rgba(0,0,0,0.08), -4px -4px 12px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.7); }
        .row { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-top: 1px solid rgba(0,0,0,0.05); }
        .row:first-child { border-top: none; }
        .row-icon { width: 40px; height: 40px; background: #ECEEF2; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 3px 3px 8px rgba(0,0,0,0.07), -2px -2px 6px rgba(255,255,255,0.90); }
        .row-name { font-size: 14px; font-weight: 700; color: #1A1A20; }
        .row-sub  { font-size: 12px; color: rgba(26,26,32,0.38); margin-top: 2px; }
        .row-actions { display: flex; gap: 6px; margin-left: auto; flex-shrink: 0; }
        .act-btn  { padding: 6px 12px; border-radius: 9px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.12s; }
        .act-edit { background: rgba(37,99,235,0.08); color: #1D4ED8; }
        .act-edit:hover { background: rgba(37,99,235,0.14); }
        .act-del  { background: rgba(220,38,38,0.07); color: #DC2626; }
        .act-del:hover { background: rgba(220,38,38,0.13); }
        .empty { padding: 48px 24px; text-align: center; color: rgba(26,26,32,0.35); font-size: 14px; font-weight: 500; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
        @media (min-width: 768px) { .overlay { align-items: center; } }
        .modal { background: #ECEEF2; border-radius: 28px 28px 0 0; padding: 28px 24px 40px; width: 100%; max-width: 520px; box-shadow: 0 -8px 40px rgba(0,0,0,0.14); }
        @media (min-width: 768px) { .modal { border-radius: 28px; padding: 32px; } }
        .modal-title { font-size: 20px; font-weight: 800; color: #1A1A20; margin-bottom: 20px; }
        .field-lbl { font-size: 11px; font-weight: 700; color: rgba(26,26,32,0.35); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .field-input, .field-textarea { width: 100%; padding: 13px 16px; background: rgba(0,0,0,0.03); border: 1.5px solid rgba(0,0,0,0.07); border-radius: 14px; font-size: 15px; font-weight: 500; color: #1A1A20; font-family: inherit; outline: none; box-shadow: inset 2px 2px 6px rgba(0,0,0,0.06), inset -2px -2px 5px rgba(255,255,255,0.80); transition: border-color 0.15s; margin-bottom: 14px; }
        .field-input:focus, .field-textarea:focus { border-color: #2563EB; }
        .field-textarea { resize: vertical; min-height: 72px; }
        .alert-err { background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.15); border-radius: 12px; padding: 10px 14px; font-size: 13px; font-weight: 600; color: #991b1b; margin-bottom: 14px; }
        .modal-actions { display: flex; gap: 10px; }
        .btn-cancel { flex: 1; padding: 14px; border-radius: 14px; border: 1.5px solid rgba(0,0,0,0.10); background: transparent; font-size: 15px; font-weight: 700; color: rgba(26,26,32,0.50); cursor: pointer; font-family: inherit; }
        .btn-save   { flex: 2; padding: 14px; border-radius: 14px; border: none; background: linear-gradient(145deg,#1D4ED8,#2563EB); font-size: 15px; font-weight: 700; color: white; cursor: pointer; font-family: inherit; box-shadow: 0 6px 18px rgba(29,78,216,0.28); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="shell">
        <Sidebar orgName={orgName} userName={userName} active="brands" />
        <main className="main">
          <div className="topbar">
            <div className="page-title">Marcas</div>
            <button className="new-btn" onClick={openCreate}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva
            </button>
          </div>
          <div className="content">
            <div className="card">
              {brands.length === 0 ? (
                <div className="empty">Sin marcas — crea la primera para clasificar tus productos</div>
              ) : brands.map(b => (
                <div key={b.id} className="row">
                  <div className="row-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth="1.8" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row-name">{b.name}</div>
                    <div className="row-sub">{b.productCount} producto{b.productCount !== 1 ? 's' : ''}{b.description ? ` · ${b.description}` : ''}</div>
                  </div>
                  <div className="row-actions">
                    <button className="act-btn act-edit" onClick={() => openEdit(b)}>Editar</button>
                    <button className="act-btn act-del" onClick={() => handleDelete(b.id)} disabled={deleting === b.id}>{deleting === b.id ? '...' : 'Eliminar'}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <BottomNav active="brands" />

      {showForm && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && closeForm()}>
          <div className="modal">
            <div className="modal-title">{editing ? 'Editar marca' : 'Nueva marca'}</div>
            {err && <div className="alert-err">{err}</div>}
            <div className="field-lbl">Nombre *</div>
            <input className="field-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Nike, Samsung, Zara..." autoFocus />
            <div className="field-lbl">Descripción (opcional)</div>
            <textarea className="field-textarea" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción breve..." />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeForm}>Cancelar</button>
              <button className="btn-save" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
