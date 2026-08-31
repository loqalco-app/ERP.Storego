import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CategoriesClient from './CategoriesClient'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, organization_id, organizations(name)')
    .eq('id', user.id).single()

  const orgId = profile?.organization_id

  const [{ data: categories }, { data: productCounts }] = await Promise.all([
    supabase.from('categories').select('id, name, slug, description, parent_id').eq('organization_id', orgId).order('name'),
    supabase.from('products').select('category_id').eq('organization_id', orgId).eq('status', 'active'),
  ])

  const countMap: Record<string, number> = {}
  for (const p of productCounts ?? []) {
    if (p.category_id) countMap[p.category_id] = (countMap[p.category_id] ?? 0) + 1
  }

  return (
    <CategoriesClient
      categories={(categories ?? []).map(c => ({ ...c, productCount: countMap[c.id] ?? 0 }))}
      orgId={orgId}
      userName={profile?.full_name && !profile.full_name.includes('@') ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')}
      orgName={(profile?.organizations as unknown as { name: string } | null)?.name ?? 'Store ERP'}
    />
  )
}
