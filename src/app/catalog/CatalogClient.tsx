'use client'

import { useState, useEffect, useMemo } from 'react'
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
  active:   { label:'Activo',    bg:'rgba(5,150,105,0.10)',   color:'#065f46' },
  draft:    { label:'Borrador',  bg:'rgba(202,138,4,0.10)',   color:'#92400e' },
  archived: { label:'Archivado', bg:'rgba(107,114,128,0.12)', color:'#374151' },
}

const PER_PAGE_OPTIONS = [6, 12, 20, 50] as const

export default function CatalogClient({ products: initProducts, categories: initCats, brands: initBrands, orgId }: Props) {
  const [tab, setTab]               = useState<'products'|'categories'|'brands'>('products')
  const [products, setProducts]     = useState(initProducts)
  const [categories, setCategories] = useState(initCats)
  const [brands, setBrands]         = useState(initBrands)
  const [q, setQ]                   = useState('')

  // Products pagination + view
  const [perPage, setPerPage]       = useState<6|12|20|50>(12)
  const [page, setPage]             = useState(1)
  const [viewMode, setViewMode]     = useState<'list'|'grid'>('list')

  // Independent collapsible sets for categories/brands
  const [expandedCats,    setExpandedCats]    = useState<Set<string>>(new Set())
  const [expandedSubCats, setExpandedSubCats] = useState<Set<string>>(new Set())
  const [expandedBrands,  setExpandedBrands]  = useState<Set<string>>(new Set())

  // Modal state
  const [modal, setModal]       = useState<null|'category'|'brand'>(null)
  const [editItem, setEditItem] = useState<Category|Brand|null>(null)
  const [mName, setMName]       = useState('')
  const [mDesc, setMDesc]       = useState('')
  const [mParent, setMParent]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<string|null>(null)
  const [viewProduct, setViewProduct] = useState<Product|null>(null)

  // Reset page when search changes
  useEffect(() => { setPage(1) }, [q, perPage])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setViewProduct(null); setModal(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Toggle helpers
  function toggleCat(id: string) {
    setExpandedCats(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSubCat(id: string) {
    setExpandedSubCats(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleBrand(id: string) {
    setExpandedBrands(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function openCat(item?: Category, forceParent?: string) {
    setEditItem(item ?? null); setMName(item?.name ?? ''); setMDesc(item?.description ?? ''); setMParent(forceParent ?? item?.parent_id ?? ''); setErr(null); setModal('category')
  }
  function openBrand(item?: Brand) {
    setEditItem(item ?? null); setMName(item?.name ?? ''); setMDesc(item?.description ?? ''); setErr(null); setModal('brand')
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
    if (editItem) {
      const { error } = await supabase.from('brands').update({ name: mName.trim(), description: mDesc.trim()||null }).eq('id', editItem.id)
      if (error) { setSaving(false); setErr(error.message); return }
      setBrands(bs => bs.map(b => b.id === editItem.id ? { ...b, name: mName.trim(), description: mDesc.trim()||null } : b))
    } else {
      const { data, error } = await supabase.from('brands')
        .insert({ organization_id: orgId, name: mName.trim(), description: mDesc.trim()||null })
        .select('id,name,description').single()
      if (error) { setSaving(false); setErr(error.message); return }
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

  // Derived data
  const filtered = useMemo(() => products.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.product_variants.some(v => v.sku.toLowerCase().includes(q.toLowerCase()))
  ), [products, q])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage    = Math.min(page, totalPages)
  const paginated   = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  const roots    = categories.filter(c => !c.parent_id)
  const children = (parentId: string) => categories.filter(c => c.parent_id === parentId)

  function productsByCat(catId: string) {
    const childIds = categories.filter(c => c.parent_id === catId).map(c => c.id)
    return products.filter(p => p.category_id === catId || childIds.includes(p.category_id ?? ''))
  }
  function productsByBrand(brandId: string) { return products.filter(p => p.brand_id === brandId) }

  // Pagination page numbers (show at most 7 slots)
  function pageNumbers(): (number|'...')[] {
    if (totalPages <= 7) return Array.from({length: totalPages}, (_,i) => i+1)
    const arr: (number|'...')[] = [1]
    if (safePage > 3) arr.push('...')
    for (let i = Math.max(2, safePage-1); i <= Math.min(totalPages-1, safePage+1); i++) arr.push(i)
    if (safePage < totalPages - 2) arr.push('...')
    arr.push(totalPages)
    return arr
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#ECEEF2;font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}

        /* ── Shared card shell ── */
        .card{background:#ECEEF2;border-radius:22px;overflow:hidden;box-shadow:6px 6px 18px rgba(0,0,0,0.08),-4px -4px 12px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.7)}

        /* ── Toolbar ── */
        .toolbar{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap}
        .search-wrap{position:relative;flex:1;min-width:160px}
        .search-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);pointer-events:none}
        .search-input{width:100%;padding:10px 14px 10px 40px;background:#ECEEF2;border:1.5px solid rgba(0,0,0,0.07);border-radius:14px;font-size:13px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none;box-shadow:inset 3px 3px 8px rgba(0,0,0,0.07),inset -2px -2px 6px rgba(255,255,255,0.85)}
        .search-input::placeholder{color:rgba(26,26,32,0.28)}
        .search-input:focus{border-color:#2563EB}

        .per-page-sel{padding:9px 28px 9px 12px;background:#ECEEF2;border:1.5px solid rgba(0,0,0,0.07);border-radius:12px;font-size:12px;font-weight:600;color:#1A1A20;font-family:inherit;outline:none;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='7' viewBox='0 0 10 7' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%231A1A20' stroke-opacity='.4' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;box-shadow:3px 3px 8px rgba(0,0,0,0.07),-2px -2px 6px rgba(255,255,255,0.90)}

        .view-toggle{display:flex;gap:4px;background:#ECEEF2;border-radius:12px;padding:4px;box-shadow:inset 3px 3px 7px rgba(0,0,0,0.07),inset -2px -2px 5px rgba(255,255,255,0.85)}
        .vt-btn{width:32px;height:32px;border:none;border-radius:9px;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.14s,box-shadow 0.14s;color:rgba(26,26,32,0.4)}
        .vt-btn.on{background:#ECEEF2;box-shadow:3px 3px 8px rgba(0,0,0,0.09),-2px -2px 6px rgba(255,255,255,0.90);color:#1D4ED8}

        .new-btn{display:flex;align-items:center;gap:6px;padding:9px 14px;border-radius:14px;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;border:none;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;text-decoration:none;box-shadow:0 4px 14px rgba(29,78,216,0.28);transition:opacity 0.15s,transform 0.12s;flex-shrink:0;white-space:nowrap}
        .new-btn:hover{opacity:.90}
        .new-btn:active{transform:scale(0.96)}

        /* ── List view table ── */
        .tbl-wrap{background:#ECEEF2;border-radius:22px;overflow:hidden;box-shadow:6px 6px 18px rgba(0,0,0,0.08),-4px -4px 12px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.7)}
        .tbl-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
        table.ptbl{width:100%;border-collapse:collapse;min-width:640px}
        .ptbl thead th{padding:11px 16px;font-size:10px;font-weight:700;color:rgba(26,26,32,0.35);text-transform:uppercase;letter-spacing:0.07em;text-align:left;border-bottom:1px solid rgba(0,0,0,0.05);white-space:nowrap;background:rgba(0,0,0,0.012)}
        .ptbl thead th:first-child{padding-left:18px;width:46px}
        .ptbl thead th:last-child{text-align:center}
        .ptbl tbody tr{border-top:1px solid rgba(0,0,0,0.042);transition:background 0.12s;cursor:pointer}
        .ptbl tbody tr:first-child{border-top:none}
        .ptbl tbody tr:hover{background:rgba(29,78,216,0.033)}
        .ptbl td{padding:12px 16px;vertical-align:middle}
        .ptbl td:first-child{padding-left:18px}
        .ptbl td:last-child{text-align:center}
        .p-icon{width:36px;height:36px;background:#ECEEF2;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:3px 3px 8px rgba(0,0,0,0.07),-2px -2px 6px rgba(255,255,255,0.90)}
        .p-name{font-size:13px;font-weight:700;color:#1A1A20;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
        .p-meta{font-size:10px;font-weight:600;color:rgba(26,26,32,0.32);margin-top:2px;font-family:'SF Mono',ui-monospace,monospace}
        .p-cat{font-size:12px;font-weight:600;color:rgba(26,26,32,0.52)}
        .p-cost{font-size:12px;font-weight:600;color:rgba(26,26,32,0.40)}
        .p-sale{font-size:13px;font-weight:800;color:#1D4ED8}
        .p-sub{font-size:10px;color:rgba(26,26,32,0.30);margin-top:2px}
        .stock-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:50px;font-size:11px;font-weight:700}
        .s-ok{background:rgba(5,150,105,0.10);color:#065f46}
        .s-low{background:rgba(202,138,4,0.10);color:#92400e}
        .s-zero{background:rgba(220,38,38,0.08);color:#991b1b}
        .badge{display:inline-block;padding:3px 9px;border-radius:50px;font-size:10px;font-weight:700}
        .edit-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 11px;border-radius:9px;border:none;background:rgba(29,78,216,0.08);color:#1D4ED8;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 0.12s;text-decoration:none;white-space:nowrap}
        .edit-btn:hover{background:rgba(29,78,216,0.14)}

        @media(max-width:860px){.ptbl .hide-md{display:none}}
        @media(max-width:600px){
          .tbl-scroll{overflow-x:auto}
          table.ptbl{min-width:560px}
        }

        /* ── Grid view ── */
        .grid-wrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:14px}
        @media(min-width:640px){.grid-wrap{grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}}
        .g-card{background:#ECEEF2;border-radius:20px;box-shadow:5px 5px 15px rgba(0,0,0,0.08),-3px -3px 10px rgba(255,255,255,0.92),inset 0 1px 0 rgba(255,255,255,0.65);padding:16px;cursor:pointer;transition:transform 0.14s,box-shadow 0.14s;display:flex;flex-direction:column;gap:10px}
        .g-card:hover{transform:translateY(-2px);box-shadow:7px 7px 20px rgba(0,0,0,0.10),-4px -4px 13px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.65)}
        .g-icon{width:44px;height:44px;background:#ECEEF2;border-radius:13px;display:flex;align-items:center;justify-content:center;box-shadow:4px 4px 10px rgba(0,0,0,0.07),-3px -3px 8px rgba(255,255,255,0.90)}
        .g-name{font-size:13px;font-weight:700;color:#1A1A20;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
        .g-cat{font-size:11px;font-weight:600;color:rgba(26,26,32,0.38);margin-top:1px}
        .g-price{font-size:15px;font-weight:800;color:#1D4ED8;margin-top:auto}
        .g-row{display:flex;align-items:center;justify-content:space-between;gap:6px}

        /* ── Pagination ── */
        .pager{display:flex;align-items:center;justify-content:center;gap:4px;margin-top:18px;flex-wrap:wrap}
        .pg-btn{min-width:34px;height:34px;border-radius:10px;border:none;background:#ECEEF2;color:rgba(26,26,32,0.55);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;padding:0 8px;box-shadow:3px 3px 8px rgba(0,0,0,0.07),-2px -2px 6px rgba(255,255,255,0.90);transition:background 0.12s,color 0.12s}
        .pg-btn:hover:not(:disabled){background:rgba(29,78,216,0.08);color:#1D4ED8}
        .pg-btn.on{background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;box-shadow:0 4px 12px rgba(29,78,216,0.28)}
        .pg-btn:disabled{opacity:0.35;cursor:not-allowed}
        .pg-dots{font-size:12px;color:rgba(26,26,32,0.35);padding:0 2px}
        .pager-info{font-size:11px;color:rgba(26,26,32,0.35);font-weight:500;margin-bottom:6px;text-align:center}

        /* ── Categories & Brands accordion ── */
        .acc-item{border-top:1px solid rgba(0,0,0,0.045)}
        .acc-item:first-child{border-top:none}
        .acc-row{display:flex;align-items:center;gap:10px;padding:14px 18px;cursor:pointer;transition:background 0.12s;user-select:none}
        .acc-row:hover{background:rgba(29,78,216,0.033)}
        .acc-arrow{transition:transform 0.18s;flex-shrink:0;color:rgba(26,26,32,0.30)}
        .acc-arrow.open{transform:rotate(90deg)}
        .acc-icon{width:34px;height:34px;background:#ECEEF2;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:3px 3px 8px rgba(0,0,0,0.07),-2px -2px 6px rgba(255,255,255,0.90)}
        .acc-name{font-size:13px;font-weight:700;color:#1A1A20;flex:1;min-width:0}
        .acc-desc{font-size:11px;color:rgba(26,26,32,0.38);margin-top:1px}
        .cnt-badge{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;background:rgba(29,78,216,0.10);border-radius:50px;font-size:11px;font-weight:700;color:#1D4ED8;flex-shrink:0}
        .acc-actions{display:flex;gap:5px;flex-shrink:0}
        .act{padding:5px 10px;border-radius:8px;border:none;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
        .act-e{background:rgba(37,99,235,0.08);color:#1D4ED8}
        .act-e:hover{background:rgba(37,99,235,0.14)}
        .act-g{background:rgba(5,150,105,0.08);color:#065f46}
        .act-g:hover{background:rgba(5,150,105,0.14)}
        .act-d{background:rgba(220,38,38,0.07);color:#DC2626}
        .act-d:hover{background:rgba(220,38,38,0.12)}

        /* Sub-level indent */
        .sub-acc-row{padding-left:44px;background:rgba(0,0,0,0.01)}
        .sub-dot{width:5px;height:5px;border-radius:50%;background:rgba(29,78,216,0.28);flex-shrink:0}

        /* Products inside accordion */
        .inner-prods{background:rgba(0,0,0,0.022);border-top:1px solid rgba(0,0,0,0.05)}
        .inner-prod{display:flex;align-items:center;gap:10px;padding:10px 18px 10px 58px;border-top:1px solid rgba(0,0,0,0.04);transition:background 0.1s;background:none;border-left:none;border-right:none;border-bottom:none;width:100%;text-align:left;cursor:pointer;font-family:inherit}
        .inner-prod:first-child{border-top:none}
        .inner-prod:hover{background:rgba(37,99,235,0.04)}
        .inner-prod-name{font-size:13px;font-weight:600;color:#1A1A20}
        .inner-prod-meta{font-size:11px;color:rgba(26,26,32,0.38)}
        .inner-empty{padding:12px 18px 12px 58px;font-size:12px;color:rgba(26,26,32,0.35);font-style:italic}

        .empty{padding:48px 20px;text-align:center;color:rgba(26,26,32,0.30);font-size:14px;font-weight:500}
        .res-count{font-size:12px;color:rgba(26,26,32,0.32);font-weight:500;margin-bottom:10px}

        /* ── Modals ── */
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.40);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:400;display:flex;align-items:flex-end;justify-content:center}
        @media(min-width:768px){.overlay{align-items:center}}
        .modal{background:#ECEEF2;border-radius:28px 28px 0 0;padding:28px 24px 40px;width:100%;max-width:520px;box-shadow:0 -8px 40px rgba(0,0,0,0.14)}
        @media(min-width:768px){.modal{border-radius:28px;padding:32px}}
        .modal-title{font-size:20px;font-weight:800;color:#1A1A20;margin-bottom:18px}
        .fl{font-size:10px;font-weight:700;color:rgba(26,26,32,0.35);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px}
        .fi,.fs{width:100%;padding:12px 14px;background:rgba(0,0,0,0.03);border:1.5px solid rgba(0,0,0,0.07);border-radius:13px;font-size:14px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none;box-shadow:inset 2px 2px 5px rgba(0,0,0,0.06),inset -2px -2px 4px rgba(255,255,255,0.80);margin-bottom:12px;transition:border-color 0.15s}
        .fi:focus,.fs:focus{border-color:#2563EB}
        .fs{appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%231A1A20' stroke-opacity='.4' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;background-color:rgba(0,0,0,0.03)}
        .alert-e{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:12px;padding:10px 14px;font-size:12px;font-weight:600;color:#991b1b;margin-bottom:12px}
        .m-actions{display:flex;gap:10px;margin-top:4px}
        .m-cancel{flex:1;padding:13px;border-radius:13px;border:1.5px solid rgba(0,0,0,0.10);background:transparent;font-size:14px;font-weight:700;color:rgba(26,26,32,0.50);cursor:pointer;font-family:inherit}
        .m-save{flex:2;padding:13px;border-radius:13px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);font-size:14px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:0 6px 18px rgba(29,78,216,0.28)}
        .m-save:disabled{opacity:0.5;cursor:not-allowed}

        /* ── Product detail modal ── */
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
        .pd-sku{font-size:11px;font-weight:700;font-family:'SF Mono',ui-monospace,monospace;color:rgba(26,26,32,0.55)}
        .pd-footer{padding:0 24px 28px;display:flex;gap:10px}
        .pd-edit-btn{flex:1;padding:14px;border-radius:16px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);font-size:15px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:0 6px 18px rgba(29,78,216,0.28);text-decoration:none;text-align:center;display:flex;align-items:center;justify-content:center;gap:7px;transition:opacity 0.15s}
        .pd-edit-btn:hover{opacity:.92}
      `}</style>

      <Sidebar active="catalog" />

      <div className="content">
        <div className="page-hd">
          <div className="page-hd-row">
            <div className="page-title">Inventario</div>
          </div>
          <div className="page-hd-tabs">
            {(['products','categories','brands'] as const).map(t => (
              <button key={t} className={`page-hd-tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
                {t === 'products' ? 'Productos' : t === 'categories' ? 'Categorías' : 'Marcas'}
              </button>
            ))}
          </div>
        </div>

        {/* ── PRODUCTOS ── */}
        {tab === 'products' && (
          <>
            {/* Toolbar */}
            <div className="toolbar">
              <div className="search-wrap">
                <div className="search-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.35)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <input className="search-input" placeholder="Buscar producto o SKU..." value={q} onChange={e => setQ(e.target.value)} />
              </div>

              {/* Entries per page */}
              <select className="per-page-sel" value={perPage} onChange={e => { setPerPage(Number(e.target.value) as 6|12|20|50); setPage(1) }}>
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} por página</option>)}
              </select>

              {/* View toggle */}
              <div className="view-toggle">
                <button className={`vt-btn${viewMode === 'list' ? ' on' : ''}`} onClick={() => setViewMode('list')} title="Vista lista">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
                <button className={`vt-btn${viewMode === 'grid' ? ' on' : ''}`} onClick={() => setViewMode('grid')} title="Vista cuadrícula">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                </button>
              </div>

              {/* Add product */}
              <Link href="/catalog/new" className="new-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Agregar
              </Link>
            </div>

            {/* Result info */}
            {filtered.length > 0 && (
              <div className="res-count">
                Mostrando {(safePage-1)*perPage+1}–{Math.min(safePage*perPage, filtered.length)} de {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
              </div>
            )}

            {/* ── LIST VIEW ── */}
            {viewMode === 'list' && (
              <div className="tbl-wrap">
                {paginated.length === 0 ? (
                  <div className="empty">{q ? `Sin resultados para "${q}"` : 'Sin productos — crea el primero'}</div>
                ) : (
                  <div className="tbl-scroll">
                    <table className="ptbl">
                      <thead>
                        <tr>
                          <th style={{width:44}}></th>
                          <th>Producto</th>
                          <th className="hide-md">Categoría</th>
                          <th className="hide-md">Precio costo</th>
                          <th>Precio venta</th>
                          <th>Stock</th>
                          <th>Estado</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map(p => {
                          const salePrice = minPrice(p.product_variants)
                          const costPrice = minCost(p.product_variants)
                          const stock     = totalStock(p.product_variants)
                          const cat       = (p.categories as unknown as { name: string } | null)?.name
                          const sm        = STATUS_META[p.status] ?? STATUS_META.draft
                          const stockCls  = stock === 0 ? 's-zero' : stock < 5 ? 's-low' : 's-ok'
                          return (
                            <tr key={p.id} onClick={() => setViewProduct(p)}>
                              <td>
                                <div className="p-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.50)" strokeWidth="1.8" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                </div>
                              </td>
                              <td>
                                <div className="p-name">{p.name}</div>
                                <div className="p-meta">{cat ?? ''}</div>
                              </td>
                              <td className="hide-md">
                                <div className="p-cat">{cat ?? <span style={{opacity:.35}}>—</span>}</div>
                              </td>
                              <td className="hide-md">
                                <div className="p-cost">{costPrice !== null && costPrice > 0 ? `$${fmt(costPrice)}` : <span style={{opacity:.35}}>—</span>}</div>
                              </td>
                              <td>
                                <div className="p-sale">{salePrice !== null ? `$${fmt(salePrice)}` : <span style={{opacity:.35}}>—</span>}</div>
                                {p.product_variants.length > 1 && <div className="p-sub">{p.product_variants.length} vars</div>}
                              </td>
                              <td>
                                <span className={`stock-pill ${stockCls}`}>
                                  <span style={{width:5,height:5,borderRadius:'50%',background:'currentColor',display:'inline-block',opacity:.7}} />
                                  {stock}
                                </span>
                              </td>
                              <td>
                                <span className="badge" style={{background:sm.bg,color:sm.color}}>{sm.label}</span>
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <Link href={`/catalog/${p.id}/edit`} className="edit-btn">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
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
            )}

            {/* ── GRID VIEW ── */}
            {viewMode === 'grid' && (
              paginated.length === 0 ? (
                <div className="card"><div className="empty">{q ? `Sin resultados para "${q}"` : 'Sin productos — crea el primero'}</div></div>
              ) : (
                <div className="grid-wrap">
                  {paginated.map(p => {
                    const salePrice = minPrice(p.product_variants)
                    const stock     = totalStock(p.product_variants)
                    const cat       = (p.categories as unknown as { name: string } | null)?.name
                    const sm        = STATUS_META[p.status] ?? STATUS_META.draft
                    const stockCls  = stock === 0 ? '#DC2626' : stock < 5 ? '#D97706' : '#059669'
                    return (
                      <div key={p.id} className="g-card" onClick={() => setViewProduct(p)}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                          <div className="g-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.50)" strokeWidth="1.8" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                          </div>
                          <span className="badge" style={{background:sm.bg,color:sm.color,flexShrink:0}}>{sm.label}</span>
                        </div>
                        <div>
                          <div className="g-name">{p.name}</div>
                          {cat && <div className="g-cat">{cat}</div>}
                        </div>
                        <div className="g-row">
                          <div className="g-price">{salePrice !== null ? `$${fmt(salePrice)}` : '—'}</div>
                          <span style={{fontSize:11,fontWeight:700,color:stockCls}}>{stock} pcs</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* ── PAGINATION ── */}
            {totalPages > 1 && (
              <div className="pager">
                <button className="pg-btn" disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p-1))}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                {pageNumbers().map((n, i) =>
                  n === '...' ? (
                    <span key={`d${i}`} className="pg-dots">···</span>
                  ) : (
                    <button key={n} className={`pg-btn${safePage === n ? ' on' : ''}`} onClick={() => setPage(n as number)}>{n}</button>
                  )
                )}
                <button className="pg-btn" disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p+1))}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}
          </>
        )}

        {/* ── CATEGORÍAS ── */}
        {tab === 'categories' && (
          <>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
              <button className="new-btn" onClick={() => openCat()}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Nueva categoría
              </button>
            </div>
            <div className="card">
              {categories.length === 0 ? (
                <div className="empty">Sin categorías — crea la primera</div>
              ) : roots.map(root => {
                const isOpen  = expandedCats.has(root.id)
                const subs    = children(root.id)
                const rootProds = products.filter(p => p.category_id === root.id)
                const total   = productsByCat(root.id).length
                return (
                  <div key={root.id} className="acc-item">
                    {/* Root row */}
                    <div className="acc-row" onClick={() => toggleCat(root.id)}>
                      <svg className={`acc-arrow${isOpen ? ' open' : ''}`} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                      <div className="acc-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="9" height="9" rx="2"/><rect x="13" y="3" width="9" height="9" rx="2"/><rect x="2" y="14" width="9" height="9" rx="2"/><rect x="13" y="14" width="9" height="9" rx="2"/></svg>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="acc-name">{root.name}</div>
                        {root.description && <div className="acc-desc">{root.description}</div>}
                      </div>
                      <span className="cnt-badge">{total}</span>
                      <div className="acc-actions" onClick={e => e.stopPropagation()}>
                        <button className="act act-e" onClick={() => openCat(root)}>Editar</button>
                        <button className="act act-g" onClick={() => openCat(undefined, root.id)}>+ Sub</button>
                        <button className="act act-d" onClick={() => deleteCat(root.id)}>Eliminar</button>
                      </div>
                    </div>

                    {/* Subcategories + root products when expanded */}
                    {isOpen && (
                      <>
                        {subs.map(sub => {
                          const subOpen  = expandedSubCats.has(sub.id)
                          const subProds = products.filter(p => p.category_id === sub.id)
                          return (
                            <div key={sub.id}>
                              <div className="acc-row sub-acc-row" onClick={() => toggleSubCat(sub.id)}>
                                <svg className={`acc-arrow${subOpen ? ' open' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                <div className="sub-dot" />
                                <div style={{flex:1,minWidth:0}}>
                                  <div className="acc-name" style={{fontSize:12}}>{sub.name}</div>
                                  {sub.description && <div className="acc-desc">{sub.description}</div>}
                                </div>
                                <span className="cnt-badge">{subProds.length}</span>
                                <div className="acc-actions" onClick={e => e.stopPropagation()}>
                                  <button className="act act-e" onClick={() => openCat(sub)}>Editar</button>
                                  <button className="act act-d" onClick={() => deleteCat(sub.id)}>Eliminar</button>
                                </div>
                              </div>
                              {subOpen && (
                                <div className="inner-prods">
                                  {subProds.length === 0 ? (
                                    <div className="inner-empty">Sin productos en esta subcategoría</div>
                                  ) : subProds.map(p => (
                                    <button key={p.id} className="inner-prod" onClick={() => setViewProduct(p)}>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div className="inner-prod-name">{p.name}</div>
                                        <div className="inner-prod-meta">${minPrice(p.product_variants)?.toLocaleString('es-MX',{minimumFractionDigits:2}) ?? '—'} · {totalStock(p.product_variants)} en stock</div>
                                      </div>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.25)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Products directly under root category */}
                        {rootProds.length > 0 && (
                          <div className="inner-prods">
                            {rootProds.map(p => (
                              <button key={p.id} className="inner-prod" onClick={() => setViewProduct(p)}>
                                <div style={{flex:1,minWidth:0}}>
                                  <div className="inner-prod-name">{p.name}</div>
                                  <div className="inner-prod-meta">${minPrice(p.product_variants)?.toLocaleString('es-MX',{minimumFractionDigits:2}) ?? '—'} · {totalStock(p.product_variants)} en stock</div>
                                </div>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.25)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── MARCAS ── */}
        {tab === 'brands' && (
          <>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
              <button className="new-btn" onClick={() => openBrand()}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Nueva marca
              </button>
            </div>
            <div className="card">
              {brands.length === 0 ? (
                <div className="empty">Sin marcas — crea la primera</div>
              ) : brands.map(b => {
                const isOpen = expandedBrands.has(b.id)
                const bProds = productsByBrand(b.id)
                return (
                  <div key={b.id} className="acc-item">
                    <div className="acc-row" onClick={() => toggleBrand(b.id)}>
                      <svg className={`acc-arrow${isOpen ? ' open' : ''}`} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                      <div className="acc-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth="1.8" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="acc-name">{b.name}</div>
                        {b.description && <div className="acc-desc">{b.description}</div>}
                      </div>
                      <span className="cnt-badge">{bProds.length}</span>
                      <div className="acc-actions" onClick={e => e.stopPropagation()}>
                        <button className="act act-e" onClick={() => openBrand(b)}>Editar</button>
                        <button className="act act-d" onClick={() => deleteBrand(b.id)}>Eliminar</button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="inner-prods">
                        {bProds.length === 0 ? (
                          <div className="inner-empty">Sin productos de esta marca</div>
                        ) : bProds.map(p => (
                          <button key={p.id} className="inner-prod" onClick={() => setViewProduct(p)}>
                            <div style={{flex:1,minWidth:0}}>
                              <div className="inner-prod-name">{p.name}</div>
                              <div className="inner-prod-meta">
                                {(p.categories as unknown as {name:string}|null)?.name ?? 'Sin categoría'} · ${minPrice(p.product_variants)?.toLocaleString('es-MX',{minimumFractionDigits:2}) ?? '—'} · {totalStock(p.product_variants)} en stock
                              </div>
                            </div>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.25)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Modal detalle de producto ── */}
      {viewProduct && (() => {
        const p       = viewProduct
        const cat     = (p.categories as unknown as {name:string}|null)?.name
        const brand   = (p.brands    as unknown as {name:string}|null)?.name
        const stock   = totalStock(p.product_variants)
        const sm      = STATUS_META[p.status] ?? STATUS_META.draft
        const sColor  = stock === 0 ? '#DC2626' : stock < 5 ? '#D97706' : '#059669'
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
                    <span className="pd-chip" style={{color:sColor}}>{stock} en stock</span>
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

      {/* ── Modal categoría ── */}
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

      {/* ── Modal marca ── */}
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
