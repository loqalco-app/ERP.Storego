'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/client'

/* ── Types ── */
interface Category { id: string; name: string; slug: string; description: string | null; parent_id: string | null }
interface Brand    { id: string; name: string; description: string | null }
interface Variant  { id: string; sku: string; sale_price: number; cost_price: number; stock_levels: { quantity_available: number }[] }
interface Product  { id: string; name: string; status: string; condition: string; created_at: string; category_id: string | null; brand_id: string | null; categories: { id: string; name: string } | null; brands: { id: string; name: string } | null; product_variants: Variant[] }

interface Props { products: Product[]; categories: Category[]; brands: Brand[]; orgId: string; userName: string; orgName: string }

function slugify(s: string) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') }
function totalStock(variants: Variant[]) { return variants.reduce((s,v) => s + v.stock_levels.reduce((a,sl) => a + sl.quantity_available, 0), 0) }
function minPrice(variants: Variant[]) { if (!variants.length) return null; return Math.min(...variants.map(v => v.sale_price)) }
function minCost(variants: Variant[])  { if (!variants.length) return null; return Math.min(...variants.map(v => v.cost_price ?? 0)) }
function fmt(n: number) { return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
const STATUS_META: Record<string,{ label:string; bg:string; color:string }> = {
  active:   { label:'Activo',   bg:'rgba(5,150,105,0.10)',   color:'#065f46' },
  draft:    { label:'Borrador', bg:'rgba(202,138,4,0.10)',   color:'#92400e' },
  archived: { label:'Archivado',bg:'rgba(107,114,128,0.12)', color:'#374151' },
}

export default function CatalogClient({ products: initProducts, categories: initCats, brands: initBrands, orgId, userName, orgName }: Props) {
  const [tab, setTab]               = useState<'products'|'categories'|'brands'>('products')
  const [products, setProducts]     = useState(initProducts)
  const [categories, setCategories] = useState(initCats)
  const [brands, setBrands]         = useState(initBrands)
  const [q, setQ]                   = useState('')

  // Expanded rows
  const [expandedCat,   setExpandedCat]   = useState<string|null>(null)
  const [expandedBrand, setExpandedBrand] = useState<string|null>(null)

  // Modal state
  const [modal, setModal]     = useState<null|'category'|'brand'>(null)
  const [editItem, setEditItem] = useState<Category|Brand|null>(null)
  const [mName, setMName]     = useState('')
  const [mDesc, setMDesc]     = useState('')
  const [mParent, setMParent] = useState('')
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState<string|null>(null)

  // Product detail modal
  const [viewProduct, setViewProduct] = useState<Product|null>(null)

  // Escape cierra cualquier modal abierto
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setViewProduct(null)
      setModal(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function openCat(item?: Category, forceParent?: string) {
    setEditItem(item ?? null)
    setMName(item?.name ?? '')
    setMDesc(item?.description ?? '')
    setMParent(forceParent ?? item?.parent_id ?? '')
    setErr(null)
    setModal('category')
  }
  function openBrand(item?: Brand) {
    setEditItem(item ?? null)
    setMName(item?.name ?? '')
    setMDesc(item?.description ?? '')
    setErr(null)
    setModal('brand')
  }
  function closeModal() { setModal(null); setEditItem(null) }

  async function saveCategory() {
    if (!mName.trim()) { setErr('El nombre es obligatorio.'); return }
    setSaving(true); setErr(null)
    const supabase = createClient()
    const slug = slugify(mName.trim())
    if (editItem) {
      const { error } = await supabase.from('categories').update({ name: mName.trim(), description: mDesc.trim()||null, parent_id: mParent||null }).eq('id', editItem.id)
      if (error) { setSaving(false); setErr(error.message); return }
      setCategories(cs => cs.map(c => c.id === editItem.id ? { ...c, name: mName.trim(), description: mDesc.trim()||null, parent_id: mParent||null } : c))
    } else {
      const { data, error } = await supabase.from('categories')
        .insert({ organization_id: orgId, name: mName.trim(), description: mDesc.trim()||null, parent_id: mParent||null, slug })
        .select('id,name,slug,description,parent_id').single()
      if (error) { setSaving(false); setErr(error.message.includes('slug') ? 'Ya existe una categoría con ese nombre.' : error.message); return }
      setCategories(cs => [...cs, data])
    }
    setSaving(false); closeModal()
  }

  async function saveBrand() {
    if (!mName.trim()) { setErr('El nombre es obligatorio.'); return }
    setSaving(true); setErr(null)
    const supabase = createClient()
    const slug = slugify(mName.trim())
    if (editItem) {
      const { error } = await supabase.from('brands').update({ name: mName.trim(), description: mDesc.trim()||null }).eq('id', editItem.id)
      if (error) { setSaving(false); setErr(error.message); return }
      setBrands(bs => bs.map(b => b.id === editItem.id ? { ...b, name: mName.trim(), description: mDesc.trim()||null } : b))
    } else {
      const { data, error } = await supabase.from('brands')
        .insert({ organization_id: orgId, name: mName.trim(), description: mDesc.trim()||null })
        .select('id,name,description').single()
      if (error) { setSaving(false); setErr(error.message.includes('slug') ? 'Ya existe una marca con ese nombre.' : error.message); return }
      setBrands(bs => [...bs, data])
    }
    setSaving(false); closeModal()
  }

  async function deleteCat(id: string) {
    if (!confirm('¿Eliminar esta categoría?')) return
    await createClient().from('categories').delete().eq('id', id)
    setCategories(cs => cs.filter(c => c.id !== id))
    setProducts(ps => ps.map(p => p.category_id === id ? { ...p, category_id: null, categories: null } : p))
  }
  async function deleteBrand(id: string) {
    if (!confirm('¿Eliminar esta marca?')) return
    await createClient().from('brands').delete().eq('id', id)
    setBrands(bs => bs.filter(b => b.id !== id))
    setProducts(ps => ps.map(p => p.brand_id === id ? { ...p, brand_id: null, brands: null } : p))
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.product_variants.some(v => v.sku.toLowerCase().includes(q.toLowerCase()))
  )

  const roots    = categories.filter(c => !c.parent_id)
  const children = (parentId: string) => categories.filter(c => c.parent_id === parentId)

  // Products by category (including subcategories of that category)
  function productsByCat(catId: string) {
    const childIds = categories.filter(c => c.parent_id === catId).map(c => c.id)
    return products.filter(p => p.category_id === catId || childIds.includes(p.category_id ?? ''))
  }
  function productsByBrand(brandId: string) {
    return products.filter(p => p.brand_id === brandId)
  }
  function productCount(catId: string) { return productsByCat(catId).length }
  function brandProductCount(brandId: string) { return productsByBrand(brandId).length }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:var(--font,'Inter',-apple-system,sans-serif);-webkit-font-smoothing:antialiased}
        .topbar{display:flex;align-items:center;flex-wrap:nowrap;justify-content:space-between}
        /* Botón agregar — visible siempre, compacto */
        .new-btn{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;border:none;cursor:pointer;font-family:inherit;text-decoration:none;box-shadow:0 4px 14px rgba(29,78,216,0.30);transition:opacity 0.15s,transform 0.12s;flex-shrink:0}
        .new-btn:hover{opacity:.90}
        .new-btn:active{transform:scale(0.90)}
        .new-btn-lbl{display:none}
        @media(min-width:600px){
          .new-btn{width:auto;height:auto;border-radius:50px;padding:8px 14px;gap:6px}
          .new-btn-lbl{display:inline;font-size:12px;font-weight:700}
        }
        .content{padding-left:20px;padding-right:20px;padding-bottom:calc(var(--nav-h,88px) + 16px)}
        @media(min-width:768px){.content{padding-left:40px;padding-right:40px;padding-bottom:calc(var(--nav-h,88px) + 16px)}}

        .tabs{display:flex;gap:8px;margin-bottom:20px}
        .tab{flex:1;padding:11px 8px;border-radius:50px;border:2px solid rgba(0,0,0,0.08);background:#ECEEF2;font-size:13px;font-weight:700;color:rgba(26,26,32,0.45);cursor:pointer;font-family:inherit;transition:all 0.18s;box-shadow:3px 3px 8px rgba(0,0,0,0.07),-2px -2px 6px rgba(255,255,255,0.90)}
        .tab.on{background:linear-gradient(135deg,#1D4ED8,#2563EB);color:white;border-color:transparent;box-shadow:0 6px 18px rgba(29,78,216,0.32)}

        .search-wrap{margin-bottom:14px;position:relative}
        .search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none}
        .search-input{width:100%;padding:12px 16px 12px 42px;background:#ECEEF2;border:1.5px solid rgba(0,0,0,0.07);border-radius:16px;font-size:14px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none;box-shadow:inset 3px 3px 8px rgba(0,0,0,0.07),inset -2px -2px 6px rgba(255,255,255,0.85)}
        .search-input::placeholder{color:rgba(26,26,32,0.28)}
        .search-input:focus{border-color:#2563EB}

        .card{background:#ECEEF2;border-radius:24px;overflow:hidden;box-shadow:6px 6px 18px rgba(0,0,0,0.08),-4px -4px 12px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.7)}

        /* ── Product table ── */
        .tbl-wrap{background:#ECEEF2;border-radius:24px;overflow:hidden;box-shadow:6px 6px 18px rgba(0,0,0,0.08),-4px -4px 12px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.7)}
        .tbl-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
        table.ptbl{width:100%;border-collapse:collapse;min-width:680px}
        .ptbl thead th{padding:11px 16px;font-size:10px;font-weight:700;color:rgba(26,26,32,0.38);text-transform:uppercase;letter-spacing:0.07em;text-align:left;border-bottom:1px solid rgba(0,0,0,0.05);white-space:nowrap;background:rgba(0,0,0,0.015)}
        .ptbl thead th:first-child{padding-left:20px}
        .ptbl thead th:last-child{text-align:center}
        .ptbl tbody tr{border-top:1px solid rgba(0,0,0,0.04);transition:background 0.12s;cursor:pointer}
        .ptbl tbody tr:first-child{border-top:none}
        .ptbl tbody tr:hover{background:rgba(29,78,216,0.035)}
        .ptbl td{padding:13px 16px;vertical-align:middle}
        .ptbl td:first-child{padding-left:20px}
        .ptbl td:last-child{text-align:center}
        .p-icon{width:38px;height:38px;background:#ECEEF2;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:3px 3px 8px rgba(0,0,0,0.07),-2px -2px 6px rgba(255,255,255,0.90)}
        .p-name{font-size:13px;font-weight:700;color:#1A1A20;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
        .p-sku{font-size:10px;font-weight:600;color:rgba(26,26,32,0.35);margin-top:2px;font-family:'SF Mono',ui-monospace,monospace;letter-spacing:0.03em}
        .p-cat{font-size:12px;font-weight:600;color:rgba(26,26,32,0.55)}
        .p-brand{font-size:11px;color:rgba(26,26,32,0.35);margin-top:1px}
        .p-cost{font-size:13px;font-weight:600;color:rgba(26,26,32,0.45)}
        .p-sale{font-size:13px;font-weight:800;color:#1D4ED8}
        .p-variants{font-size:11px;color:rgba(26,26,32,0.35);margin-top:1px}
        .stock-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:50px;font-size:11px;font-weight:700}
        .stock-ok{background:rgba(5,150,105,0.10);color:#065f46}
        .stock-low{background:rgba(202,138,4,0.10);color:#92400e}
        .stock-zero{background:rgba(220,38,38,0.08);color:#991b1b}
        .badge{display:inline-block;padding:3px 9px;border-radius:50px;font-size:10px;font-weight:700}
        .edit-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:10px;border:none;background:rgba(29,78,216,0.08);color:#1D4ED8;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 0.12s;text-decoration:none;white-space:nowrap}
        .edit-btn:hover{background:rgba(29,78,216,0.15)}

        /* Mobile: horizontal scroll en pantallas < 768px */
        @media(max-width:767px){
          .tbl-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
          table.ptbl{min-width:720px}
        }
        /* Ocultar columna Marca en pantallas medianas si hay poco espacio */
        @media(max-width:959px){
          .ptbl .td-brand,.ptbl thead th:nth-child(4){display:none}
        }
        /* Mobile compacto: layout de tarjeta por fila */
        @media(max-width:540px){
          .tbl-scroll{overflow-x:unset}
          table.ptbl{display:block;min-width:0}
          .ptbl thead{display:none}
          .ptbl tbody{display:flex;flex-direction:column}
          .ptbl tbody tr{display:grid;grid-template-columns:44px 1fr auto;align-items:center;padding:13px 18px;border-top:1px solid rgba(0,0,0,0.04)}
          .ptbl td{padding:0}
          .ptbl td.td-icon{display:flex;align-items:center}
          .ptbl td.td-main{padding:0 10px}
          .ptbl td.td-price{text-align:right}
          .ptbl td.td-cat,.ptbl td.td-brand,.ptbl td.td-cost,.ptbl td.td-stock,.ptbl td.td-status,.ptbl td.td-action{display:none}
          .p-cat-inline{font-size:11px;color:rgba(26,26,32,0.38);margin-top:2px}
          .p-sku{display:none}
        }

        .count-badge{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;background:rgba(29,78,216,0.10);border-radius:50px;font-size:11px;font-weight:700;color:#1D4ED8}

        .list-row{display:flex;align-items:center;gap:10px;padding:14px 18px;border-top:1px solid rgba(0,0,0,0.05);cursor:pointer;transition:background 0.12s}
        .list-row:first-child{border-top:none}
        .list-row:hover{background:rgba(37,99,235,0.04)}
        .list-icon{width:36px;height:36px;background:#ECEEF2;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:3px 3px 8px rgba(0,0,0,0.07),-2px -2px 6px rgba(255,255,255,0.90)}
        .list-name{font-size:13px;font-weight:700;color:#1A1A20}
        .list-sub{font-size:11px;color:rgba(26,26,32,0.38);margin-top:1px}
        .list-actions{display:flex;gap:6px;margin-left:auto;flex-shrink:0}
        .act{padding:5px 10px;border-radius:8px;border:none;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit}
        .act-e{background:rgba(37,99,235,0.08);color:#1D4ED8}
        .act-g{background:rgba(5,150,105,0.08);color:#065f46}
        .act-d{background:rgba(220,38,38,0.07);color:#DC2626}

        .sub-row{padding-left:50px;background:rgba(0,0,0,0.01)}
        .expand-arrow{transition:transform 0.2s;flex-shrink:0}
        .expand-arrow.open{transform:rotate(90deg)}

        /* Products inside expanded category/brand */
        .inner-products{background:rgba(0,0,0,0.025);border-top:1px solid rgba(0,0,0,0.06)}
        .inner-prod{display:flex;align-items:center;gap:10px;padding:10px 18px 10px 54px;border-top:1px solid rgba(0,0,0,0.04);text-decoration:none;transition:background 0.1s}
        .inner-prod:first-child{border-top:none}
        .inner-prod:hover{background:rgba(37,99,235,0.05)}
        .inner-prod-name{font-size:13px;font-weight:600;color:#1A1A20}
        .inner-prod-meta{font-size:11px;color:rgba(26,26,32,0.38)}
        .inner-empty{padding:12px 18px 12px 54px;font-size:12px;color:rgba(26,26,32,0.35);font-style:italic}

        .empty{padding:40px 20px;text-align:center;color:rgba(26,26,32,0.32);font-size:14px;font-weight:500}
        .count{font-size:12px;color:rgba(26,26,32,0.32);font-weight:500;margin-bottom:10px}

        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.40);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:400;display:flex;align-items:flex-end;justify-content:center}
        @media(min-width:768px){.overlay{align-items:center}}
        .modal{background:#ECEEF2;border-radius:28px 28px 0 0;padding:28px 24px 40px;width:100%;max-width:520px;box-shadow:0 -8px 40px rgba(0,0,0,0.14)}
        @media(min-width:768px){.modal{border-radius:28px;padding:32px}}
        .modal-title{font-size:20px;font-weight:800;color:#1A1A20;margin-bottom:18px}
        .fl{font-size:10px;font-weight:700;color:rgba(26,26,32,0.35);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px}
        .fi,.fs{width:100%;padding:12px 14px;background:rgba(0,0,0,0.03);border:1.5px solid rgba(0,0,0,0.07);border-radius:13px;font-size:14px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none;box-shadow:inset 2px 2px 5px rgba(0,0,0,0.06),inset -2px -2px 4px rgba(255,255,255,0.80);margin-bottom:12px;transition:border-color 0.15s}
        .fi:focus,.fs:focus{border-color:#2563EB}
        .fs{appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%231A1A20' stroke-opacity='.4' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
        .alert-e{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:12px;padding:10px 14px;font-size:12px;font-weight:600;color:#991b1b;margin-bottom:12px}
        .m-actions{display:flex;gap:10px;margin-top:4px}
        .m-cancel{flex:1;padding:13px;border-radius:13px;border:1.5px solid rgba(0,0,0,0.10);background:transparent;font-size:14px;font-weight:700;color:rgba(26,26,32,0.50);cursor:pointer;font-family:inherit}
        .m-save{flex:2;padding:13px;border-radius:13px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);font-size:14px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:0 6px 18px rgba(29,78,216,0.28)}
        .m-save:disabled{opacity:0.5;cursor:not-allowed}

        /* Product detail modal */
        .pd-scrim{position:fixed;inset:0;background:rgba(0,0,0,0.44);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:400;display:flex;align-items:flex-end;justify-content:center}
        @media(min-width:600px){.pd-scrim{align-items:center}}
        .pd-modal{background:#ECEEF2;border-radius:28px 28px 0 0;width:100%;max-width:520px;max-height:88dvh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,0.16);display:flex;flex-direction:column}
        @media(min-width:600px){.pd-modal{border-radius:28px;max-height:82dvh;margin:0 12px}}
        .pd-header{padding:24px 24px 0;display:flex;align-items:flex-start;gap:14px}
        .pd-icon{width:48px;height:48px;border-radius:14px;background:#ECEEF2;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:4px 4px 10px rgba(0,0,0,0.08),-3px -3px 8px rgba(255,255,255,0.90)}
        .pd-title{font-size:18px;font-weight:800;color:#1A1A20;letter-spacing:-0.3px;line-height:1.2;flex:1}
        .pd-close{width:32px;height:32px;border-radius:50%;border:none;background:rgba(0,0,0,0.07);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:rgba(26,26,32,0.55)}
        .pd-close:hover{background:rgba(0,0,0,0.12)}
        .pd-body{padding:16px 24px 24px;flex:1;overflow-y:auto}
        .pd-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
        .pd-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:50px;background:rgba(0,0,0,0.055);font-size:11px;font-weight:600;color:rgba(26,26,32,0.60)}
        .pd-section{font-size:10px;font-weight:700;color:rgba(26,26,32,0.35);text-transform:uppercase;letter-spacing:0.07em;margin:16px 0 8px}
        .pd-card{background:#ECEEF2;border-radius:16px;box-shadow:4px 4px 12px rgba(0,0,0,0.07),-3px -3px 8px rgba(255,255,255,0.90);overflow:hidden;margin-bottom:12px}
        .pd-row{display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-top:1px solid rgba(0,0,0,0.05)}
        .pd-row:first-child{border-top:none}
        .pd-label{font-size:11px;font-weight:600;color:rgba(26,26,32,0.40)}
        .pd-value{font-size:13px;font-weight:700;color:#1A1A20}
        .pd-variant{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid rgba(0,0,0,0.05)}
        .pd-variant:first-child{border-top:none}
        .pd-sku{font-size:11px;font-weight:700;font-family:'SF Mono',ui-monospace,monospace;color:rgba(26,26,32,0.55);letter-spacing:0.03em}
        .pd-footer{padding:0 24px 28px;display:flex;gap:10px}
        .pd-edit-btn{flex:1;padding:14px;border-radius:16px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);font-size:15px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:0 6px 18px rgba(29,78,216,0.28);text-decoration:none;text-align:center;display:flex;align-items:center;justify-content:center;gap:7px;transition:opacity 0.15s}
        .pd-edit-btn:hover{opacity:.92}
      `}</style>

      <Sidebar active="catalog" />

      <div className="topbar">
        <div className="page-title">Inventario</div>
        {tab === 'products'   && <Link href="/catalog/new" className="new-btn" aria-label="Agregar producto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span className="new-btn-lbl">+ Producto</span></Link>}
        {tab === 'categories' && <button className="new-btn" onClick={() => openCat()} aria-label="Agregar categoría"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span className="new-btn-lbl">+ Categoría</span></button>}
        {tab === 'brands'     && <button className="new-btn" onClick={() => openBrand()} aria-label="Agregar marca"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span className="new-btn-lbl">+ Marca</span></button>}
      </div>

          <div className="content">
            <div className="tabs">
              {(['products','categories','brands'] as const).map(t => (
                <button key={t} className={`tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
                  {t === 'products' ? 'Productos' : t === 'categories' ? 'Categorías' : 'Marcas'}
                </button>
              ))}
            </div>

            {/* ── PRODUCTOS ── */}
            {tab === 'products' && (
              <>
                <div className="search-wrap">
                  <div className="search-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.35)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                  <input className="search-input" placeholder="Buscar por nombre, SKU o marca..." value={q} onChange={e => setQ(e.target.value)} />
                </div>
                {filteredProducts.length > 0 && <div className="count">{filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}</div>}
                <div className="tbl-wrap">
                  {filteredProducts.length === 0 ? (
                    <div className="empty" style={{minWidth:0}}>{q ? `Sin resultados para "${q}"` : 'Sin productos — crea el primero'}</div>
                  ) : (
                    <div className="tbl-scroll">
                      <table className="ptbl">
                        <thead>
                          <tr>
                            <th style={{width:44}}></th>
                            <th>Producto</th>
                            <th>Categoría</th>
                            <th>Marca</th>
                            <th>Precio costo</th>
                            <th>Precio venta</th>
                            <th>Stock</th>
                            <th>Estado</th>
                            <th>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProducts.map(p => {
                            const salePrice = minPrice(p.product_variants)
                            const costPrice = minCost(p.product_variants)
                            const stock     = totalStock(p.product_variants)
                            const cat       = (p.categories as unknown as { name: string } | null)?.name
                            const brand     = (p.brands    as unknown as { name: string } | null)?.name
                            const sku       = p.product_variants[0]?.sku ?? '—'
                            const sm        = STATUS_META[p.status] ?? STATUS_META.draft
                            const stockCls  = stock === 0 ? 'stock-zero' : stock < 5 ? 'stock-low' : 'stock-ok'
                            const varCount  = p.product_variants.length
                            return (
                              <tr key={p.id} onClick={() => setViewProduct(p)}>
                                {/* Icon */}
                                <td className="td-icon">
                                  <div className="p-icon">
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth="1.8" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                  </div>
                                </td>
                                {/* Nombre + SKU */}
                                <td className="td-main">
                                  <div className="p-name">{p.name}</div>
                                  {/* mobile inline cat+brand */}
                                  <div className="p-cat-inline">{[cat, brand].filter(Boolean).join(' · ')}</div>
                                </td>
                                {/* Categoría */}
                                <td className="td-cat">
                                  <div className="p-cat">{cat ?? <span style={{opacity:.4}}>—</span>}</div>
                                </td>
                                {/* Marca */}
                                <td className="td-brand">
                                  <div className="p-cat">{brand ?? <span style={{opacity:.4}}>—</span>}</div>
                                </td>
                                {/* Precio costo */}
                                <td className="td-cost">
                                  <div className="p-cost">{costPrice !== null && costPrice > 0 ? `$${fmt(costPrice)}` : <span style={{opacity:.35}}>—</span>}</div>
                                </td>
                                {/* Precio venta */}
                                <td className="td-price">
                                  <div className="p-sale">{salePrice !== null ? `$${fmt(salePrice)}` : <span style={{opacity:.35}}>—</span>}</div>
                                  {varCount > 1 && <div className="p-variants">{varCount} variantes</div>}
                                </td>
                                {/* Stock */}
                                <td className="td-stock">
                                  <span className={`stock-pill ${stockCls}`}>
                                    <span style={{width:5,height:5,borderRadius:'50%',background:'currentColor',display:'inline-block',opacity:.7}} />
                                    {stock}
                                  </span>
                                </td>
                                {/* Estado */}
                                <td className="td-status">
                                  <span className="badge" style={{background:sm.bg,color:sm.color}}>{sm.label}</span>
                                </td>
                                {/* Acción */}
                                <td className="td-action" onClick={e => e.stopPropagation()}>
                                  <Link href={`/catalog/${p.id}/edit`} className="edit-btn">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    Editar
                                  </Link>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── CATEGORÍAS ── */}
            {tab === 'categories' && (
              <div className="card">
                {categories.length === 0 ? (
                  <div className="empty">Sin categorías — crea la primera</div>
                ) : roots.map(root => {
                  const rootProds  = productsByCat(root.id)
                  const isExpanded = expandedCat === root.id
                  return (
                    <div key={root.id}>
                      {/* Root row */}
                      <div className="list-row" onClick={() => setExpandedCat(isExpanded ? null : root.id)}>
                        <svg className={`expand-arrow${isExpanded ? ' open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.35)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                        <div className="list-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="9" height="9" rx="2"/><rect x="13" y="3" width="9" height="9" rx="2"/><rect x="2" y="14" width="9" height="9" rx="2"/><rect x="13" y="14" width="9" height="9" rx="2"/></svg></div>
                        <div style={{flex:1,minWidth:0}}>
                          <div className="list-name">{root.name}</div>
                          {root.description && <div className="list-sub">{root.description}</div>}
                        </div>
                        <span className="count-badge" style={{marginRight:6}}>{rootProds.length}</span>
                        <div className="list-actions" onClick={e => e.stopPropagation()}>
                          <button className="act act-e" onClick={() => openCat(root)}>Editar</button>
                          <button className="act act-g" onClick={() => openCat(undefined, root.id)}>+ Sub</button>
                          <button className="act act-d" onClick={() => deleteCat(root.id)}>Eliminar</button>
                        </div>
                      </div>

                      {/* Subcategories */}
                      {children(root.id).map(child => {
                        const childProds  = products.filter(p => p.category_id === child.id)
                        const childExpanded = expandedCat === child.id
                        return (
                          <div key={child.id}>
                            <div className="list-row sub-row" onClick={() => setExpandedCat(childExpanded ? null : child.id)}>
                              <svg className={`expand-arrow${childExpanded ? ' open' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.30)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                              <div style={{width:5,height:5,borderRadius:'50%',background:'rgba(29,78,216,0.30)',flexShrink:0,marginRight:2}} />
                              <div style={{flex:1,minWidth:0}}><div className="list-name" style={{fontSize:12}}>{child.name}</div>{child.description && <div className="list-sub">{child.description}</div>}</div>
                              <span className="count-badge" style={{marginRight:6}}>{childProds.length}</span>
                              <div className="list-actions" onClick={e => e.stopPropagation()}>
                                <button className="act act-e" onClick={() => openCat(child)}>Editar</button>
                                <button className="act act-d" onClick={() => deleteCat(child.id)}>Eliminar</button>
                              </div>
                            </div>
                            {childExpanded && (
                              <div className="inner-products">
                                {childProds.length === 0 ? (
                                  <div className="inner-empty">Sin productos en esta subcategoría</div>
                                ) : childProds.map(p => (
                                  <Link key={p.id} href={`/catalog/${p.id}/edit`} className="inner-prod">
                                    <div style={{flex:1,minWidth:0}}>
                                      <div className="inner-prod-name">{p.name}</div>
                                      <div className="inner-prod-meta">${minPrice(p.product_variants)?.toLocaleString('es-MX',{minimumFractionDigits:2}) ?? '—'} · {totalStock(p.product_variants)} en stock</div>
                                    </div>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.25)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Expanded root: show products assigned directly to root */}
                      {isExpanded && (
                        <div className="inner-products">
                          {rootProds.length === 0 ? (
                            <div className="inner-empty">Sin productos en esta categoría</div>
                          ) : rootProds.map(p => (
                            <Link key={p.id} href={`/catalog/${p.id}/edit`} className="inner-prod">
                              <div style={{flex:1,minWidth:0}}>
                                <div className="inner-prod-name">{p.name}</div>
                                <div className="inner-prod-meta">
                                  {(p.categories as unknown as {name:string}|null)?.name ?? ''} · ${minPrice(p.product_variants)?.toLocaleString('es-MX',{minimumFractionDigits:2}) ?? '—'} · {totalStock(p.product_variants)} en stock
                                </div>
                              </div>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.25)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {/* Orphan categories (no parent defined in roots) */}
                {categories.filter(c => c.parent_id && !categories.find(r => r.id === c.parent_id)).map(c => (
                  <div key={c.id} className="list-row">
                    <div className="list-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="9" height="9" rx="2"/><rect x="13" y="3" width="9" height="9" rx="2"/><rect x="2" y="14" width="9" height="9" rx="2"/><rect x="13" y="14" width="9" height="9" rx="2"/></svg></div>
                    <div style={{flex:1,minWidth:0}}><div className="list-name">{c.name}</div></div>
                    <div className="list-actions">
                      <button className="act act-e" onClick={() => openCat(c)}>Editar</button>
                      <button className="act act-d" onClick={() => deleteCat(c.id)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── MARCAS ── */}
            {tab === 'brands' && (
              <div className="card">
                {brands.length === 0 ? (
                  <div className="empty">Sin marcas — crea la primera</div>
                ) : brands.map(b => {
                  const bProds     = productsByBrand(b.id)
                  const isExpanded = expandedBrand === b.id
                  return (
                    <div key={b.id}>
                      <div className="list-row" onClick={() => setExpandedBrand(isExpanded ? null : b.id)}>
                        <svg className={`expand-arrow${isExpanded ? ' open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.35)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                        <div className="list-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth="1.8" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></div>
                        <div style={{flex:1,minWidth:0}}>
                          <div className="list-name">{b.name}</div>
                          {b.description && <div className="list-sub">{b.description}</div>}
                        </div>
                        <span className="count-badge" style={{marginRight:6}}>{brandProductCount(b.id)}</span>
                        <div className="list-actions" onClick={e => e.stopPropagation()}>
                          <button className="act act-e" onClick={() => openBrand(b)}>Editar</button>
                          <button className="act act-d" onClick={() => deleteBrand(b.id)}>Eliminar</button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="inner-products">
                          {bProds.length === 0 ? (
                            <div className="inner-empty">Sin productos de esta marca</div>
                          ) : bProds.map(p => (
                            <Link key={p.id} href={`/catalog/${p.id}/edit`} className="inner-prod">
                              <div style={{flex:1,minWidth:0}}>
                                <div className="inner-prod-name">{p.name}</div>
                                <div className="inner-prod-meta">
                                  {(p.categories as unknown as {name:string}|null)?.name ?? 'Sin categoría'} · ${minPrice(p.product_variants)?.toLocaleString('es-MX',{minimumFractionDigits:2}) ?? '—'} · {totalStock(p.product_variants)} en stock
                                </div>
                              </div>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.25)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

      {/* ── Modal detalle de producto ── */}
      {viewProduct && (() => {
        const p = viewProduct
        const cat   = (p.categories as unknown as {name:string}|null)?.name
        const brand = (p.brands    as unknown as {name:string}|null)?.name
        const stock = totalStock(p.product_variants)
        const sm    = STATUS_META[p.status] ?? STATUS_META.draft
        const stockCls = stock === 0 ? '#DC2626' : stock < 5 ? '#D97706' : '#059669'
        return (
          <div className="pd-scrim" onClick={e => { if (e.target === e.currentTarget) setViewProduct(null) }}>
            <div className="pd-modal">
              <div className="pd-header">
                <div className="pd-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth="1.8" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="pd-title">{p.name}</div>
                  <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:5}}>
                    <span className="badge" style={{background:sm.bg,color:sm.color}}>{sm.label}</span>
                    {p.condition !== 'new' && <span className="badge" style={{background:'rgba(107,114,128,0.10)',color:'#374151'}}>{p.condition === 'used' ? 'Usado' : p.condition}</span>}
                  </div>
                </div>
                <button className="pd-close" onClick={() => setViewProduct(null)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="pd-body">
                {(cat || brand) && (
                  <div className="pd-chips" style={{marginTop:14}}>
                    {cat   && <span className="pd-chip"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="9" height="9" rx="2"/><rect x="13" y="3" width="9" height="9" rx="2"/><rect x="2" y="14" width="9" height="9" rx="2"/><rect x="13" y="14" width="9" height="9" rx="2"/></svg>{cat}</span>}
                    {brand && <span className="pd-chip"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>{brand}</span>}
                    <span className="pd-chip" style={{color:stockCls}}>{stock} en stock</span>
                  </div>
                )}

                <div className="pd-section">Variantes ({p.product_variants.length})</div>
                <div className="pd-card">
                  {p.product_variants.map(v => {
                    const vStock = v.stock_levels.reduce((a,sl) => a + sl.quantity_available, 0)
                    return (
                      <div key={v.id} className="pd-variant">
                        <div>
                          <div className="pd-sku">{v.sku}</div>
                          <div style={{fontSize:11,color:'rgba(26,26,32,0.40)',marginTop:2}}>{vStock} en stock</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:15,fontWeight:800,color:'#1D4ED8'}}>${fmt(v.sale_price)}</div>
                          {v.cost_price > 0 && <div style={{fontSize:11,color:'rgba(26,26,32,0.40)',marginTop:1}}>Costo ${fmt(v.cost_price)}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="pd-section">Detalles</div>
                <div className="pd-card">
                  <div className="pd-row"><span className="pd-label">Creado</span><span className="pd-value">{new Date(p.created_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
                  <div className="pd-row"><span className="pd-label">Categoría</span><span className="pd-value">{cat ?? '—'}</span></div>
                  <div className="pd-row"><span className="pd-label">Marca</span><span className="pd-value">{brand ?? '—'}</span></div>
                  <div className="pd-row"><span className="pd-label">Condición</span><span className="pd-value">{p.condition === 'new' ? 'Nuevo' : p.condition === 'used' ? 'Usado' : p.condition}</span></div>
                </div>
              </div>

              <div className="pd-footer">
                <button style={{flex:1,padding:'13px',borderRadius:14,border:'1.5px solid rgba(0,0,0,0.10)',background:'transparent',fontSize:14,fontWeight:700,color:'rgba(26,26,32,0.50)',cursor:'pointer',fontFamily:'inherit'}} onClick={() => setViewProduct(null)}>Cerrar</button>
                <Link href={`/catalog/${p.id}/edit`} className="pd-edit-btn">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editar producto
                </Link>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal categoría */}
      {modal === 'category' && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-title">{editItem ? 'Editar categoría' : mParent ? 'Nueva subcategoría' : 'Nueva categoría'}</div>
            {err && <div className="alert-e">{err}</div>}
            <div className="fl">Nombre *</div>
            <input className="fi" value={mName} onChange={e => setMName(e.target.value)} placeholder={mParent ? 'Ej. Zapatos, Camisas...' : 'Ej. Mujer, Hombre, Niños...'} autoFocus />
            <div className="fl">Categoría padre (opcional)</div>
            <select className="fs" value={mParent} onChange={e => setMParent(e.target.value)}>
              <option value="">Sin padre — es categoría raíz</option>
              {categories.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="fl">Descripción (opcional)</div>
            <input className="fi" value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="Descripción breve..." />
            <div className="m-actions">
              <button className="m-cancel" onClick={closeModal}>Cancelar</button>
              <button className="m-save" onClick={saveCategory} disabled={saving}>{saving ? 'Guardando...' : editItem ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal marca */}
      {modal === 'brand' && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-title">{editItem ? 'Editar marca' : 'Nueva marca'}</div>
            {err && <div className="alert-e">{err}</div>}
            <div className="fl">Nombre *</div>
            <input className="fi" value={mName} onChange={e => setMName(e.target.value)} placeholder="Ej. Nike, Zara, Apple..." autoFocus />
            <div className="fl">Descripción (opcional)</div>
            <input className="fi" value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="Descripción breve..." />
            <div className="m-actions">
              <button className="m-cancel" onClick={closeModal}>Cancelar</button>
              <button className="m-save" onClick={saveBrand} disabled={saving}>{saving ? 'Guardando...' : editItem ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
