import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import CatalogProductForm from '../../new/CatalogProductForm'

export const dynamic = 'force-dynamic'

export default async function EditCatalogProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('full_name, organization_id, organizations(name)').eq('id', user.id).single()

  const orgId = profile?.organization_id

  const [
    { data: product },
    { data: categories },
    { data: brands },
    { data: stockLevels },
    { data: webCats },
  ] = await Promise.all([
    supabase.from('products').select(`
      id, name, description, status, condition, category_id, brand_id,
      product_variants(id, name, sku, sale_price, cost_price),
      product_images(id, url, is_primary, sort_order, variant_id)
    `).eq('id', id).eq('organization_id', orgId).single(),
    supabase.from('categories').select('id, name, parent_id').eq('organization_id', orgId).order('name'),
    supabase.from('brands').select('id, name').eq('organization_id', orgId).order('name'),
    supabase.from('stock_levels').select('variant_id, quantity_available'),
    supabase.from('store_product_categories').select('category_id').eq('product_id', id).limit(1),
  ])

  if (!product) notFound()

  const stockMap: Record<string, number> = {}
  for (const sl of stockLevels ?? []) stockMap[sl.variant_id] = (stockMap[sl.variant_id] ?? 0) + sl.quantity_available

  type Img = { id: string; url: string; variant_id: string | null }
  type Variant = { id: string; name: string; sku: string; sale_price: number; cost_price: number }
  const images = (product.product_images ?? []) as Img[]
  const variantsRaw = (product.product_variants ?? []) as Variant[]

  const hasColorStructure = variantsRaw.some(v => v.name.includes(' / ')) || new Set(variantsRaw.map(v => v.name)).size > 1

  type ExistingColorGroup = { colorName: string; sizes: { sizeName: string; variantId: string; sku: string; stock: number }[]; photos: { id: string; url: string }[] }
  let existingColors: ExistingColorGroup[] = []
  let existingStandard: { variantId: string; sku: string; stock: number; photos: { id: string; url: string }[] } | null = null

  if (hasColorStructure && variantsRaw.length > 0) {
    const colorMap = new Map<string, ExistingColorGroup>()
    for (const v of variantsRaw) {
      const [colorName, sizeName] = v.name.includes(' / ') ? v.name.split(' / ') : [v.name, '']
      if (!colorMap.has(colorName)) colorMap.set(colorName, { colorName, sizes: [], photos: [] })
      colorMap.get(colorName)!.sizes.push({ sizeName: sizeName ?? '', variantId: v.id, sku: v.sku, stock: stockMap[v.id] ?? 0 })
    }
    const variantIdToColor = new Map<string, string>()
    for (const [colorName, block] of colorMap) for (const s of block.sizes) variantIdToColor.set(s.variantId, colorName)
    for (const img of images) {
      const colorName = img.variant_id ? variantIdToColor.get(img.variant_id) : undefined
      if (colorName && colorMap.has(colorName)) colorMap.get(colorName)!.photos.push({ id: img.id, url: img.url })
    }
    existingColors = Array.from(colorMap.values())
  } else if (variantsRaw.length === 1) {
    const v = variantsRaw[0]
    existingStandard = {
      variantId: v.id, sku: v.sku, stock: stockMap[v.id] ?? 0,
      photos: images.filter(i => !i.variant_id || i.variant_id === v.id).map(i => ({ id: i.id, url: i.url })),
    }
  }

  const salePrice = variantsRaw[0]?.sale_price ?? 0
  const costPrice = variantsRaw[0]?.cost_price ?? 0

  return (
    <CatalogProductForm
      mode="edit"
      orgId={orgId}
      productId={id}
      userName={profile?.full_name && !profile.full_name.includes('@') ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')}
      orgName={(profile?.organizations as unknown as { name: string } | null)?.name ?? 'NORTHÉA'}
      categories={categories ?? []}
      brands={brands ?? []}
      initial={{
        name: product.name, description: product.description ?? '', status: product.status, condition: product.condition,
        categoryId: product.category_id ?? '', brandId: product.brand_id ?? '',
        salePrice, costPrice, webCategoryId: webCats?.[0]?.category_id ?? '',
      }}
      existingColors={existingColors}
      existingStandard={existingStandard}
    />
  )
}
