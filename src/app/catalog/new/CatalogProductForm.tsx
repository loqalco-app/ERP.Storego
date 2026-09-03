'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

interface Category  { id: string; name: string; parent_id: string | null }
interface Brand     { id: string; name: string }
interface PhotoEntry { url: string; path: string; tempId: string }

interface ColorBlock {
  id: string
  colorName: string
  sizes: string[]
  photos: PhotoEntry[]
  sizeInput: string
}

interface VariantData {
  colorId: string
  sizeName: string
  sku: string
  cost_price: string
  sale_price: string
  stock: string
  isOpen: boolean
}

interface Props {
  mode: 'create' | 'edit'
  orgId: string; userName: string; orgName: string
  categories: Category[]; brands: Brand[]
  productId?: string
  initial?: { name: string; description: string; status: string; condition: string; categoryId: string; brandId: string }
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
function uid() { return Math.random().toString(36).slice(2, 8) }

async function compressImage(file: File, maxKB = 600): Promise<File> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const maxW = 1400
      const scale = Math.min(1, maxW / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      let quality = 0.85
      const attempt = () => {
        canvas.toBlob(blob => {
          if (blob && blob.size > maxKB * 1024 && quality > 0.45) { quality -= 0.10; attempt(); return }
          const out = blob ?? file
          resolve(new File([out], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }))
        }, 'image/webp', quality)
      }
      attempt()
    }
    img.src = URL.createObjectURL(file)
  })
}

export default function CatalogProductForm({ mode, orgId, categories, brands, initial }: Props) {
  const router = useRouter()

  const [name, setName]           = useState(initial?.name ?? '')
  const [desc, setDesc]           = useState(initial?.description ?? '')
  const [status, setStatus]       = useState(initial?.status ?? 'active')
  const [condition, setCondition] = useState(initial?.condition ?? 'new')
  const [brandId, setBrandId]     = useState(initial?.brandId ?? '')

  const initialCatId = initial?.categoryId ?? ''
  const [rootCatId, setRootCatId] = useState(() => {
    if (!initialCatId) return ''
    const cat = categories.find(c => c.id === initialCatId)
    return cat?.parent_id ? cat.parent_id : cat?.id ?? ''
  })
  const [subCatId, setSubCatId] = useState(() => {
    if (!initialCatId) return ''
    const cat = categories.find(c => c.id === initialCatId)
    return cat?.parent_id ? cat.id : ''
  })
  const categoryId = subCatId || rootCatId
  const [cats, setCats] = useState<Category[]>(categories)
  const [brds, setBrds] = useState<Brand[]>(brands)

  const [newCatName, setNewCatName]     = useState(''); const [showNewCat, setShowNewCat] = useState(false); const [catErr, setCatErr] = useState<string | null>(null)
  const [newBrandName, setNewBrandName] = useState(''); const [showNewBrand, setShowNewBrand] = useState(false); const [brandErr, setBrandErr] = useState<string | null>(null)

  const [colorBlocks, setColorBlocks] = useState<ColorBlock[]>([])
  const [colorInput, setColorInput]   = useState('')
  const [variants, setVariants]       = useState<VariantData[]>([])

  // Standard variant (no colors)
  const [stdSku, setStdSku]         = useState('')
  const [stdCost, setStdCost]       = useState('')
  const [stdPrice, setStdPrice]     = useState('')
  const [stdStock, setStdStock]     = useState('')
  const [stdOpen, setStdOpen]       = useState(true)
  const [stdPhotos, setStdPhotos]   = useState<PhotoEntry[]>([])

  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [activeTarget, setActiveTarget] = useState('std')
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  // ── Color helpers ──

  function addColor() {
    const v = colorInput.trim()
    if (!v || colorBlocks.some(b => b.colorName === v)) return
    const blockId = uid()
    setColorBlocks(cb => [...cb, { id: blockId, colorName: v, sizes: [], photos: [], sizeInput: '' }])
    // Create a no-size variant for this color right away
    const skuHint = slugify(v).toUpperCase().slice(0, 14)
    setVariants(vs => [...vs, { colorId: blockId, sizeName: '', sku: skuHint, cost_price: '', sale_price: '', stock: '', isOpen: true }])
    setColorInput('')
  }

  function removeColor(blockId: string) {
    setColorBlocks(cb => cb.filter(b => b.id !== blockId))
    setVariants(vs => vs.filter(v => v.colorId !== blockId))
  }

  function addSize(blockId: string) {
    const block = colorBlocks.find(b => b.id === blockId)
    if (!block) return
    const sz = block.sizeInput.trim()
    if (!sz || block.sizes.includes(sz)) return
    setColorBlocks(cb => cb.map(b => b.id === blockId ? { ...b, sizes: [...b.sizes, sz], sizeInput: '' } : b))
    const skuHint = slugify(block.colorName + ' ' + sz).toUpperCase().slice(0, 14)
    // If this is the first size, remove the no-size variant and replace with size variants
    setVariants(vs => {
      const withoutNoSize = vs.filter(v => !(v.colorId === blockId && v.sizeName === ''))
      return [...withoutNoSize, { colorId: blockId, sizeName: sz, sku: skuHint, cost_price: '', sale_price: '', stock: '', isOpen: true }]
    })
  }

  function removeSize(blockId: string, sz: string) {
    const block = colorBlocks.find(b => b.id === blockId)
    if (!block) return
    const newSizes = block.sizes.filter(s => s !== sz)
    setColorBlocks(cb => cb.map(b => b.id === blockId ? { ...b, sizes: newSizes } : b))
    setVariants(vs => {
      const filtered = vs.filter(v => !(v.colorId === blockId && v.sizeName === sz))
      // If no sizes left, re-add no-size variant
      if (newSizes.length === 0) {
        const skuHint = slugify(block.colorName).toUpperCase().slice(0, 14)
        return [...filtered, { colorId: blockId, sizeName: '', sku: skuHint, cost_price: '', sale_price: '', stock: '', isOpen: true }]
      }
      return filtered
    })
  }

  function setSizeInput(blockId: string, val: string) {
    setColorBlocks(cb => cb.map(b => b.id === blockId ? { ...b, sizeInput: val } : b))
  }

  function updateVariant(colorId: string, sizeName: string, field: keyof VariantData, val: string) {
    setVariants(vs => vs.map(v => v.colorId === colorId && v.sizeName === sizeName ? { ...v, [field]: val } : v))
  }

  function toggleVariant(colorId: string, sizeName: string) {
    setVariants(vs => vs.map(v => v.colorId === colorId && v.sizeName === sizeName ? { ...v, isOpen: !v.isOpen } : v))
  }

  // ── Photos ──

  async function handleFiles(files: File[], target: string) {
    setUploadingFor(target)
    const supabase = createClient()
    for (const raw of files) {
      const compressed = await compressImage(raw)
      const path = `${orgId}/${uid()}.webp`
      const { error } = await supabase.storage.from('product-images').upload(path, compressed, { contentType: 'image/webp' })
      if (error) { setErr('Error subiendo foto: ' + error.message); continue }
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
      const entry: PhotoEntry = { url: publicUrl, path, tempId: uid() }
      if (target === 'std') setStdPhotos(p => [...p, entry])
      else setColorBlocks(cb => cb.map(b => b.id === target ? { ...b, photos: [...b.photos, entry] } : b))
    }
    setUploadingFor(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  async function removePhoto(target: string, tempId: string, path: string) {
    const supabase = createClient()
    await supabase.storage.from('product-images').remove([path])
    if (target === 'std') setStdPhotos(p => p.filter(x => x.tempId !== tempId))
    else setColorBlocks(cb => cb.map(b => b.id === target ? { ...b, photos: b.photos.filter(x => x.tempId !== tempId) } : b))
  }

  function triggerUpload(target: string) {
    setActiveTarget(target)
    photoInputRef.current?.click()
  }

  // ── Inline create ──

  async function createCategory() {
    if (!newCatName.trim()) return; setCatErr(null)
    const supabase = createClient()
    const { data, error } = await supabase.from('categories').insert({ organization_id: orgId, name: newCatName.trim(), slug: slugify(newCatName.trim()) }).select('id, name, parent_id').single()
    if (error) { setCatErr(error.message.includes('slug') ? 'Ya existe esa categoría.' : error.message); return }
    if (data) { setCats(c => [...c, data]); setRootCatId(data.id); setSubCatId(''); setNewCatName(''); setShowNewCat(false) }
  }

  async function createBrand() {
    if (!newBrandName.trim()) return; setBrandErr(null)
    const supabase = createClient()
    const { data, error } = await supabase.from('brands').insert({ organization_id: orgId, name: newBrandName.trim() }).select('id, name').single()
    if (error) { setBrandErr(error.message); return }
    if (data) { setBrds(b => [...b, data]); setBrandId(data.id); setNewBrandName(''); setShowNewBrand(false) }
  }

  // ── Submit ──

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('El nombre del producto es obligatorio.'); return }
    setSaving(true); setErr(null)
    const supabase = createClient()

    let slug = slugify(name.trim())
    let { data: product, error: pErr } = await supabase.from('products').insert({ organization_id: orgId, name: name.trim(), description: desc.trim() || null, slug, status, condition, category_id: categoryId || null, brand_id: brandId || null }).select('id').single()
    if (pErr?.code === '23505' || pErr?.message?.includes('slug')) {
      slug = slugify(name.trim()) + '-' + uid()
      const retry = await supabase.from('products').insert({ organization_id: orgId, name: name.trim(), description: desc.trim() || null, slug, status, condition, category_id: categoryId || null, brand_id: brandId || null }).select('id').single()
      if (retry.error) { setSaving(false); setErr(retry.error.message); return }
      product = retry.data
    } else if (pErr) { setSaving(false); setErr(pErr.message); return }

    const pid = product!.id
    const hasColors = colorBlocks.length > 0

    const variantRows = hasColors
      ? variants.map(v => {
          const block = colorBlocks.find(b => b.id === v.colorId)!
          return { organization_id: orgId, product_id: pid, name: v.sizeName ? `${block.colorName} / ${v.sizeName}` : block.colorName, sku: v.sku.trim().toUpperCase(), sale_price: parseFloat(v.sale_price) || 0, cost_price: parseFloat(v.cost_price) || 0 }
        })
      : [{ organization_id: orgId, product_id: pid, name: 'Estándar', sku: stdSku.trim().toUpperCase(), sale_price: parseFloat(stdPrice) || 0, cost_price: parseFloat(stdCost) || 0 }]

    if (!variantRows.length) { setSaving(false); setErr('Agrega al menos una variante.'); return }
    if (variantRows.some(v => !v.sku)) { setSaving(false); setErr('Todos los SKU son obligatorios.'); return }

    const { data: insertedV, error: vErr } = await supabase.from('product_variants').insert(variantRows).select('id, name')
    if (vErr) { setSaving(false); setErr(vErr.message.includes('sku') ? 'SKU duplicado, cámbialo.' : vErr.message); return }

    if (insertedV) {
      let locId: string | null = null
      const { data: loc } = await supabase.from('inventory_locations').select('id').eq('organization_id', orgId).eq('is_default', true).single()
      if (loc) { locId = loc.id } else {
        const { data: nl } = await supabase.from('inventory_locations').insert({ organization_id: orgId, name: 'Almacén principal', is_default: true }).select('id').single()
        locId = nl?.id ?? null
      }
      if (locId) {
        const userId = (await supabase.auth.getUser()).data.user?.id
        const stockList = hasColors
          ? variants.map((v, i) => ({ qty: parseFloat(v.stock) || 0, cost: parseFloat(v.cost_price) || 0, id: insertedV[i]?.id }))
          : [{ qty: parseFloat(stdStock) || 0, cost: parseFloat(stdCost) || 0, id: insertedV[0]?.id }]
        for (const s of stockList) {
          if (!s.qty || !s.id) continue
          await supabase.from('inventory_ledger').insert({ organization_id: orgId, variant_id: s.id, location_id: locId, movement_type: 'purchase', quantity: s.qty, unit_cost: s.cost, notes: 'Stock inicial', performed_by: userId })
          await supabase.from('stock_levels').upsert({ variant_id: s.id, location_id: locId, quantity_available: s.qty }, { onConflict: 'variant_id,location_id' })
        }
      }

      // Photos
      const varIdByName: Record<string, string> = {}
      for (const iv of insertedV) { if (iv.name && iv.id) varIdByName[iv.name] = iv.id }

      const photoRows: { product_id: string; url: string; is_primary: boolean; sort_order: number; variant_id: string | null }[] = []
      if (!hasColors) {
        stdPhotos.forEach((p, i) => photoRows.push({ product_id: pid, url: p.url, is_primary: i === 0, sort_order: i, variant_id: null }))
      } else {
        for (const block of colorBlocks) {
          const linkedId = Object.entries(varIdByName).find(([n]) => n === block.colorName || n.startsWith(block.colorName + ' /'))?.[1] ?? null
          block.photos.forEach((p, i) => photoRows.push({ product_id: pid, url: p.url, is_primary: photoRows.length === 0 && i === 0, sort_order: photoRows.length, variant_id: linkedId }))
        }
      }
      if (photoRows.length) await supabase.from('product_images').insert(photoRows)
    }

    router.push('/catalog')
  }

  // ── Render ──

  const roots = cats.filter(c => !c.parent_id)
  const subs  = cats.filter(c => c.parent_id === rootCatId)
  const hasColors = colorBlocks.length > 0

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#ECEEF2;font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
        .pf-shell{display:flex;flex-direction:column;min-height:100dvh}
        @media(min-width:768px){.pf-shell{padding-top:60px}}
        .pf-topbar{display:flex;align-items:center;gap:14px;padding:16px 20px 12px;position:sticky;top:0;z-index:10;background:rgba(236,238,242,0.92);backdrop-filter:blur(16px)}
        @media(min-width:768px){.pf-topbar{padding:14px 40px 12px}}
        .back-btn{width:36px;height:36px;border-radius:10px;background:#ECEEF2;display:flex;align-items:center;justify-content:center;text-decoration:none;flex-shrink:0;box-shadow:3px 3px 8px rgba(0,0,0,0.10),-2px -2px 6px rgba(255,255,255,0.90)}
        .pf-title{font-size:20px;font-weight:800;color:#1A1A20;letter-spacing:-0.3px;flex:1}
        .save-top-btn{padding:9px 20px;border-radius:12px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);font-size:14px;font-weight:700;color:white;cursor:pointer;font-family:inherit;white-space:nowrap;box-shadow:0 4px 14px rgba(29,78,216,0.28)}
        .save-top-btn:disabled{opacity:.5;cursor:not-allowed}
        .pf-grid{display:flex;flex-direction:column;gap:0;padding:0 16px 100px}
        @media(min-width:900px){.pf-grid{display:grid;grid-template-columns:1fr 1.35fr;gap:24px;padding:20px 40px 60px;align-items:start}}
        .sec-lbl{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(26,26,32,0.35);margin:18px 0 8px}
        .sec-lbl:first-child{margin-top:0}
        .card{background:#ECEEF2;border-radius:20px;overflow:hidden;box-shadow:6px 6px 18px rgba(0,0,0,0.08),-4px -4px 12px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.7);margin-bottom:12px}
        .field{padding:13px 18px;border-top:1px solid rgba(0,0,0,0.05)}
        .field:first-child{border-top:none}
        .fl{font-size:11px;font-weight:700;color:rgba(26,26,32,0.35);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
        .fi,.fta,.fsel{width:100%;padding:11px 14px;background:rgba(0,0,0,0.03);border:1.5px solid rgba(0,0,0,0.07);border-radius:12px;font-size:14px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none;transition:border-color 0.15s;box-shadow:inset 2px 2px 5px rgba(0,0,0,0.05),inset -2px -2px 4px rgba(255,255,255,0.75)}
        .fi:focus,.fta:focus,.fsel:focus{border-color:#2563EB}
        .fta{resize:vertical;min-height:72px}
        .fsel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%231A1A20' stroke-opacity='.4' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
        .seg{display:flex;gap:6px;flex-wrap:wrap}
        .seg-btn{flex:1;min-width:fit-content;padding:9px 10px;border-radius:10px;border:1.5px solid rgba(0,0,0,0.08);background:#ECEEF2;font-size:12px;font-weight:600;color:rgba(26,26,32,0.45);cursor:pointer;font-family:inherit;transition:all 0.15s;white-space:nowrap}
        .seg-btn.on{background:#1D4ED8;color:white;border-color:#1D4ED8;box-shadow:0 3px 10px rgba(29,78,216,0.22)}
        .create-link{font-size:12px;color:#2563EB;font-weight:600;cursor:pointer;margin-top:6px;display:inline-block}
        .inline-row{display:flex;gap:6px;margin-top:8px}
        .inline-input{flex:1;padding:9px 12px;background:rgba(0,0,0,0.03);border:1.5px solid rgba(37,99,235,0.30);border-radius:10px;font-size:13px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none}
        .inline-input:focus{border-color:#2563EB}
        .inline-btn{padding:9px 14px;border-radius:10px;border:none;background:#2563EB;color:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
        .inline-cancel{padding:9px 12px;border-radius:10px;border:1.5px solid rgba(0,0,0,0.10);background:transparent;font-size:13px;font-weight:600;color:rgba(26,26,32,0.45);cursor:pointer;font-family:inherit}
        .alert-e{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:14px;padding:12px 16px;font-size:13px;font-weight:600;color:#991b1b;margin-bottom:14px}
        .hint{font-size:11px;color:rgba(26,26,32,0.38);font-weight:500;margin-top:5px;line-height:1.4}

        /* Color add row */
        .color-add-row{display:flex;gap:8px;margin-bottom:10px}
        .color-input{flex:1;padding:10px 14px;background:#ECEEF2;border:1.5px solid rgba(0,0,0,0.08);border-radius:13px;font-size:14px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none;box-shadow:inset 2px 2px 5px rgba(0,0,0,0.05),inset -2px -2px 4px rgba(255,255,255,0.75)}
        .color-input:focus{border-color:#2563EB}
        .color-add-btn{padding:10px 16px;border-radius:13px;border:none;background:#1A1A20;color:#CAFF3A;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}

        /* Color block */
        .cblock{background:#ECEEF2;border-radius:18px;padding:16px;margin-bottom:10px;box-shadow:5px 5px 16px rgba(0,0,0,0.08),-3px -3px 10px rgba(255,255,255,0.92)}
        .cblock-hdr{display:flex;align-items:center;gap:10px;margin-bottom:14px}
        .cblock-dot{width:14px;height:14px;border-radius:50%;background:#1A1A20;flex-shrink:0}
        .cblock-name{font-size:15px;font-weight:800;color:#1A1A20;flex:1}
        .cblock-rm{background:none;border:none;cursor:pointer;font-size:20px;color:rgba(26,26,32,0.25);padding:0;line-height:1}
        .cblock-rm:hover{color:#DC2626}

        /* Sizes */
        .sz-row{display:flex;gap:6px;align-items:center}
        .sz-input{flex:1;padding:9px 12px;background:rgba(0,0,0,0.04);border:1.5px solid rgba(0,0,0,0.07);border-radius:10px;font-size:13px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none}
        .sz-input:focus{border-color:#2563EB}
        .sz-add-btn{padding:9px 13px;border-radius:10px;border:none;background:rgba(29,78,216,0.10);color:#1D4ED8;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
        .sz-tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
        .sz-tag{display:flex;align-items:center;gap:4px;padding:4px 11px;border-radius:50px;background:rgba(29,78,216,0.10);font-size:12px;font-weight:700;color:#1D4ED8}
        .sz-rm{background:none;border:none;cursor:pointer;color:#1D4ED8;opacity:.45;font-size:14px;line-height:1;padding:0}
        .sz-rm:hover{opacity:1}

        /* Variant collapsible */
        .vcard{border:1.5px solid rgba(0,0,0,0.07);border-radius:13px;margin-top:8px;overflow:hidden;background:rgba(255,255,255,0.45)}
        .vcard-hdr{display:flex;align-items:center;padding:11px 14px;cursor:pointer;user-select:none;gap:8px}
        .vcard-name{font-size:13px;font-weight:700;color:#1A1A20;flex:1}
        .vcard-preview{font-size:12px;color:rgba(26,26,32,0.38);font-weight:500}
        .vcard-chevron{color:rgba(26,26,32,0.30);font-size:11px;transition:transform 0.18s;flex-shrink:0}
        .vcard-chevron.open{transform:rotate(180deg)}
        .vcard-body{border-top:1px solid rgba(0,0,0,0.06);padding:12px 14px 14px;display:flex;flex-direction:column;gap:9px}
        .v2col{display:grid;grid-template-columns:1fr 1fr;gap:8px}

        /* Photos */
        .photo-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
        .photo-thumb{position:relative;width:68px;height:68px;border-radius:10px;overflow:hidden;background:rgba(0,0,0,0.06);flex-shrink:0}
        .photo-thumb img{width:100%;height:100%;object-fit:cover}
        .photo-rm{position:absolute;top:3px;right:3px;width:19px;height:19px;border-radius:50%;border:none;background:rgba(0,0,0,0.55);color:white;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:800}
        .photo-add{width:68px;height:68px;border-radius:10px;border:2px dashed rgba(0,0,0,0.13);background:rgba(0,0,0,0.02);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;flex-shrink:0;font-family:inherit;transition:all 0.15s}
        .photo-add:hover{border-color:#2563EB;background:rgba(29,78,216,0.04)}
        .photo-add-lbl{font-size:10px;font-weight:600;color:rgba(26,26,32,0.38)}

        /* Standard variant */
        .std-card{background:#ECEEF2;border-radius:18px;padding:16px;margin-bottom:10px;box-shadow:5px 5px 16px rgba(0,0,0,0.08),-3px -3px 10px rgba(255,255,255,0.92)}
        .std-hdr{display:flex;align-items:center;justify-content:space-between;cursor:pointer;margin-bottom:4px}
        .std-name{font-size:15px;font-weight:800;color:#1A1A20}
      `}</style>

      <Sidebar active="catalog" />

      <input
        ref={photoInputRef} type="file" accept="image/*" multiple hidden
        onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) handleFiles(fs, activeTarget) }}
      />

      <div className="pf-shell">
        <div className="pf-topbar">
          <Link href="/catalog" className="back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A20" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <div className="pf-title">{mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</div>
          <button className="save-top-btn" disabled={saving} onClick={handleSubmit as any}>
            {saving ? 'Guardando…' : 'Guardar producto'}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="pf-grid">

            {/* LEFT COLUMN */}
            <div>
              {err && <div className="alert-e">{err}</div>}

              <div className="sec-lbl">Información</div>
              <div className="card">
                <div className="field">
                  <div className="fl">Nombre *</div>
                  <input className="fi" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Camiseta cuello redondo" autoFocus />
                </div>
                <div className="field">
                  <div className="fl">Descripción</div>
                  <textarea className="fta" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción, materiales, detalles…" />
                </div>
              </div>

              <div className="sec-lbl">Clasificación</div>
              <div className="card">
                <div className="field">
                  <div className="fl">Categoría</div>
                  <select className="fsel" value={rootCatId} onChange={e => { setRootCatId(e.target.value); setSubCatId('') }}>
                    <option value="">Sin categoría</option>
                    {roots.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  {showNewCat ? (
                    <>
                      <div className="inline-row">
                        <input className="inline-input" value={newCatName} onChange={e => { setNewCatName(e.target.value); setCatErr(null) }} placeholder="Nombre…" autoFocus onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), createCategory())} />
                        <button type="button" className="inline-btn" onClick={createCategory}>Crear</button>
                        <button type="button" className="inline-cancel" onClick={() => setShowNewCat(false)}>×</button>
                      </div>
                      {catErr && <div style={{ marginTop: 5, fontSize: 12, color: '#991b1b', fontWeight: 600 }}>⚠ {catErr}</div>}
                    </>
                  ) : <span className="create-link" onClick={() => setShowNewCat(true)}>+ Nueva categoría</span>}
                </div>
                {rootCatId && subs.length > 0 && (
                  <div className="field">
                    <div className="fl">Subcategoría</div>
                    <select className="fsel" value={subCatId} onChange={e => setSubCatId(e.target.value)}>
                      <option value="">— usar categoría principal —</option>
                      {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="field">
                  <div className="fl">Marca</div>
                  <select className="fsel" value={brandId} onChange={e => setBrandId(e.target.value)}>
                    <option value="">Sin marca</option>
                    {brds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {showNewBrand ? (
                    <>
                      <div className="inline-row">
                        <input className="inline-input" value={newBrandName} onChange={e => { setNewBrandName(e.target.value); setBrandErr(null) }} placeholder="Nombre de la marca…" autoFocus onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), createBrand())} />
                        <button type="button" className="inline-btn" onClick={createBrand}>Crear</button>
                        <button type="button" className="inline-cancel" onClick={() => setShowNewBrand(false)}>×</button>
                      </div>
                      {brandErr && <div style={{ marginTop: 5, fontSize: 12, color: '#991b1b', fontWeight: 600 }}>⚠ {brandErr}</div>}
                    </>
                  ) : <span className="create-link" onClick={() => setShowNewBrand(true)}>+ Nueva marca</span>}
                </div>
              </div>

              <div className="sec-lbl">Estado</div>
              <div className="card">
                <div className="field">
                  <div className="fl">Condición</div>
                  <div className="seg">
                    {([['new','Nuevo'],['used','Usado'],['refurbished','Reacondicionado']] as [string,string][]).map(([v,l]) => (
                      <button key={v} type="button" className={`seg-btn${condition===v?' on':''}`} onClick={() => setCondition(v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <div className="fl">Estado</div>
                  <div className="seg">
                    {([['active','Activo'],['draft','Borrador'],['archived','Archivado']] as [string,string][]).map(([v,l]) => (
                      <button key={v} type="button" className={`seg-btn${status===v?' on':''}`} onClick={() => setStatus(v)}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div>
              <div className="sec-lbl">Colores y variantes</div>

              <div className="color-add-row">
                <input
                  className="color-input"
                  value={colorInput}
                  onChange={e => setColorInput(e.target.value)}
                  placeholder="Agregar color — Ej. Blanca, Negra, Azul rey…"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addColor())}
                />
                <button type="button" className="color-add-btn" onClick={addColor}>+ Color</button>
              </div>

              {/* Per-color blocks */}
              {colorBlocks.map(block => {
                const blockV = variants.filter(v => v.colorId === block.id)
                return (
                  <div key={block.id} className="cblock">
                    <div className="cblock-hdr">
                      <div className="cblock-dot" />
                      <div className="cblock-name">{block.colorName}</div>
                      <button type="button" className="cblock-rm" onClick={() => removeColor(block.id)}>×</button>
                    </div>

                    {/* Sizes (independent per color) */}
                    <div className="fl">Tallas disponibles en {block.colorName}</div>
                    {block.sizes.length > 0 && (
                      <div className="sz-tags">
                        {block.sizes.map(sz => (
                          <span key={sz} className="sz-tag">
                            {sz}
                            <button type="button" className="sz-rm" onClick={() => removeSize(block.id, sz)}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="sz-row" style={{ marginBottom: 12 }}>
                      <input
                        className="sz-input"
                        value={block.sizeInput}
                        onChange={e => setSizeInput(block.id, e.target.value)}
                        placeholder={block.sizes.length === 0 ? 'Sin tallas — o escribe S, M, L, XL…' : 'Otra talla…'}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSize(block.id))}
                      />
                      <button type="button" className="sz-add-btn" onClick={() => addSize(block.id)}>+ Talla</button>
                    </div>

                    {/* Collapsible variant cards */}
                    {blockV.map(v => (
                      <div key={v.sizeName} className="vcard">
                        <div className="vcard-hdr" onClick={() => toggleVariant(block.id, v.sizeName)}>
                          <div className="vcard-name">{v.sizeName ? `${block.colorName} / ${v.sizeName}` : block.colorName}</div>
                          {!v.isOpen && v.sku && <div className="vcard-preview">{v.sku} · ${v.sale_price || '—'}</div>}
                          <span className={`vcard-chevron${v.isOpen ? ' open' : ''}`}>▼</span>
                        </div>
                        {v.isOpen && (
                          <div className="vcard-body">
                            <div>
                              <div className="fl">SKU / Código *</div>
                              <input className="fi" type="text" value={v.sku} onChange={e => updateVariant(block.id, v.sizeName, 'sku', e.target.value.toUpperCase())} placeholder="Ej. CAM-NEG-M" />
                            </div>
                            <div className="v2col">
                              <div><div className="fl">Costo</div><input className="fi" type="number" min="0" step="0.01" value={v.cost_price} onChange={e => updateVariant(block.id, v.sizeName, 'cost_price', e.target.value)} placeholder="0.00" /></div>
                              <div><div className="fl">Precio venta *</div><input className="fi" type="number" min="0" step="0.01" value={v.sale_price} onChange={e => updateVariant(block.id, v.sizeName, 'sale_price', e.target.value)} placeholder="0.00" /></div>
                            </div>
                            {mode === 'create' && (
                              <div><div className="fl">Cantidad inicial</div><input className="fi" type="number" min="0" step="1" value={v.stock} onChange={e => updateVariant(block.id, v.sizeName, 'stock', e.target.value)} placeholder="0" /></div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Photos for this color */}
                    <div className="fl" style={{ marginTop: 14 }}>Fotos de {block.colorName}</div>
                    <div className="photo-row">
                      {block.photos.map(p => (
                        <div key={p.tempId} className="photo-thumb">
                          <img src={p.url} alt="" />
                          <button type="button" className="photo-rm" onClick={() => removePhoto(block.id, p.tempId, p.path)}>×</button>
                        </div>
                      ))}
                      <button type="button" className="photo-add" onClick={() => triggerUpload(block.id)} disabled={uploadingFor === block.id}>
                        {uploadingFor === block.id
                          ? <div className="photo-add-lbl">Subiendo…</div>
                          : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.28)" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><div className="photo-add-lbl">Foto</div></>
                        }
                      </button>
                    </div>
                    <div className="hint">Estas fotos aparecen al seleccionar "{block.colorName}" en la tienda · se comprimen automáticamente</div>
                  </div>
                )
              })}

              {/* No colors → standard variant */}
              {!hasColors && (
                <>
                  <div className="std-card">
                    <div className="std-hdr" onClick={() => setStdOpen(o => !o)}>
                      <div className="std-name">Variante estándar</div>
                      <span className={`vcard-chevron${stdOpen ? ' open' : ''}`}>▼</span>
                    </div>
                    {stdOpen && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
                        <div>
                          <div className="fl">SKU / Código *</div>
                          <input className="fi" type="text" value={stdSku} onChange={e => setStdSku(e.target.value.toUpperCase())} placeholder="Ej. PROD-001" />
                        </div>
                        <div className="v2col">
                          <div><div className="fl">Costo</div><input className="fi" type="number" min="0" step="0.01" value={stdCost} onChange={e => setStdCost(e.target.value)} placeholder="0.00" /></div>
                          <div><div className="fl">Precio venta *</div><input className="fi" type="number" min="0" step="0.01" value={stdPrice} onChange={e => setStdPrice(e.target.value)} placeholder="0.00" /></div>
                        </div>
                        {mode === 'create' && (
                          <div><div className="fl">Cantidad inicial</div><input className="fi" type="number" min="0" step="1" value={stdStock} onChange={e => setStdStock(e.target.value)} placeholder="0" /></div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="sec-lbl">Fotos del producto</div>
                  <div className="card">
                    <div className="field">
                      <div className="photo-row">
                        {stdPhotos.map(p => (
                          <div key={p.tempId} className="photo-thumb">
                            <img src={p.url} alt="" />
                            <button type="button" className="photo-rm" onClick={() => removePhoto('std', p.tempId, p.path)}>×</button>
                          </div>
                        ))}
                        <button type="button" className="photo-add" onClick={() => triggerUpload('std')} disabled={uploadingFor === 'std'}>
                          {uploadingFor === 'std'
                            ? <div className="photo-add-lbl">Subiendo…</div>
                            : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.28)" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><div className="photo-add-lbl">+ Foto</div></>
                          }
                        </button>
                      </div>
                      <div className="hint">Fotos comprimidas automáticamente · máx ~600 KB · formato WebP</div>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        </form>
      </div>
    </>
  )
}
