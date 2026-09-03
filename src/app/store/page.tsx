import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StoreClient from './StoreClient'

export const dynamic = 'force-dynamic'

export default async function StorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, organization_id, organizations(name)')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organization_id
  if (!orgId) redirect('/login')

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase
      .from('store_categories')
      .select('id, parent_id, name, slug, sort_order, is_visible, description')
      .eq('organization_id', orgId)
      .order('sort_order'),
    supabase
      .from('products')
      .select(`
        id, name, slug, is_published,
        product_images(url, is_primary),
        store_product_categories(category_id)
      `)
      .eq('organization_id', orgId)
      .eq('is_published', true)
      .order('name'),
  ])

  return (
    <StoreClient
      orgId={orgId}
      categories={(categories ?? []) as any[]}
      products={(products ?? []) as any[]}
      userName={profile?.full_name ?? user.email?.split('@')[0] ?? 'Usuario'}
      orgName={(profile?.organizations as any)?.name ?? 'NORTHÉA'}
    />
  )
}
