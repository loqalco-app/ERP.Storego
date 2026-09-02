import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CustomerForm from '../CustomerForm'

export default async function NewCustomerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('full_name, organization_id, organizations(name)').eq('id', user.id).single()

  const userName = profile?.full_name && !profile.full_name.includes('@')
    ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')
  const orgName = (profile?.organizations as unknown as { name: string } | null)?.name ?? 'NORTHÉA'

  return (
    <CustomerForm
      mode="create"
      orgId={profile?.organization_id}
      userId={user.id}
      userName={userName}
      orgName={orgName}
    />
  )
}
