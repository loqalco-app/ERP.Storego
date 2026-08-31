import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, phone, avatar_url, organizations(name)')
    .eq('id', user.id)
    .single()

  return (
    <ProfileClient
      userId={user.id}
      email={user.email ?? ''}
      fullName={profile?.full_name ?? ''}
      phone={profile?.phone ?? ''}
      orgName={(profile?.organizations as unknown as { name: string } | null)?.name ?? 'Store ERP'}
    />
  )
}
