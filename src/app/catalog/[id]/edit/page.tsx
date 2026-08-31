import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import CatalogProductForm from '../../new/CatalogProductForm'

export default async function EditCatalogProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('full_name, organization_id, organizations(name)').eq('id', user.id).single()

  const orgId = profile?.organization_id

  const [{ data: product }, { data: categories }, { data: brands }] = await Promise.all([
    supabase.from('products').select('id, name, description, status, condition, category_id, brand_id, product_variants(id, name, sku, sale_price, cost_price)').eq('id', id).eq('organization_id', orgId).single(),
    supabase.from('categories').select('id, name, parent_id').eq('organization_id', orgId).order('name'),
    supabase.from('brands').select('id, name').eq('organization_id', orgId).order('name'),
  ])

  if (!product) notFound()

  const variants = (product.product_variants as unknown as Array<{ id: string; name: string; sku: string; sale_price: number; cost_price: number }>)

  return (
    <CatalogProductForm
      mode="edit"
      orgId={orgId}
      productId={id}
      userName={profile?.full_name && !profile.full_name.includes('@') ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')}
      orgName={(profile?.organizations as unknown as { name: string } | null)?.name ?? 'Store ERP'}
      categories={categories ?? []}
      brands={brands ?? []}
      initial={{ name: product.name, description: product.description ?? '', status: product.status, condition: product.condition, categoryId: product.category_id ?? '', brandId: product.brand_id ?? '', variants: variants.map(v => ({ name: v.name, sku: v.sku, sale_price: String(v.sale_price), cost_price: String(v.cost_price), stock: '' })) }}
    />
  )
}
