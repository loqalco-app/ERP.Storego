import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CustomersClient from './CustomersClient'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('full_name, organization_id, organizations(name)').eq('id', user.id).single()

  const orgId = profile?.organization_id

  const { data: customers } = await supabase
    .from('customers')
    .select('id, full_name, email, phone, status, balance_owing, credit_limit, created_at, tags')
    .eq('organization_id', orgId)
    .order('full_name', { ascending: true })

  const userName = profile?.full_name && !profile.full_name.includes('@')
    ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')
  const orgName = (profile?.organizations as unknown as { name: string } | null)?.name ?? 'Store ERP'

  return (
    <CustomersClient
      customers={customers ?? []}
      orgId={orgId}
      userName={userName}
      orgName={orgName}
    />
  )
}
