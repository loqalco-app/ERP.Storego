import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BrandsClient from './BrandsClient'

export default async function BrandsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('full_name, organization_id, organizations(name)').eq('id', user.id).single()

  const orgId = profile?.organization_id

  const [{ data: brands }, { data: productCounts }] = await Promise.all([
    supabase.from('brands').select('id, name').eq('organization_id', orgId).order('name'),
    supabase.from('products').select('brand_id').eq('organization_id', orgId).eq('status', 'active'),
  ])

  const countMap: Record<string, number> = {}
  for (const p of productCounts ?? []) {
    if (p.brand_id) countMap[p.brand_id] = (countMap[p.brand_id] ?? 0) + 1
  }

  return (
    <BrandsClient
      brands={(brands ?? []).map(b => ({ ...b, description: null, productCount: countMap[b.id] ?? 0 }))}
      orgId={orgId}
      userName={profile?.full_name && !profile.full_name.includes('@') ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')}
      orgName={(profile?.organizations as unknown as { name: string } | null)?.name ?? 'NORTHÉA'}
    />
  )
}
