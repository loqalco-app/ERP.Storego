import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProductFormClient from './ProductFormClient'

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, organization_id, organizations(name)')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organization_id

  const [{ data: categories }, { data: brands }] = await Promise.all([
    supabase.from('categories').select('id, name').eq('organization_id', orgId).order('name'),
    supabase.from('brands').select('id, name').eq('organization_id', orgId).order('name'),
  ])

  return (
    <ProductFormClient
      mode="create"
      orgId={orgId}
      userName={profile?.full_name && !profile.full_name.includes('@') ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')}
      orgName={(profile?.organizations as unknown as { name: string } | null)?.name ?? 'NORTHÉA'}
      categories={categories ?? []}
      brands={brands ?? []}
    />
  )
}
