import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeamClient from './TeamClient'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, organization_id, organizations(name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  const orgId = profile.organization_id
  const myRole = (profile as { role?: string }).role ?? 'staff'
  const orgName = (profile.organizations as unknown as { name: string } | null)?.name ?? 'Mi organización'

  // Get all members
  const { data: members } = await supabase
    .from('user_profiles')
    .select('id, full_name, avatar_url, role, status, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  // Get auth emails for members — only works server-side with service role, so we join on id
  // We'll show email from auth only for current user; others show full_name only

  // Get pending invitations
  const { data: invitations } = await supabase
    .from('organization_invitations')
    .select('id, email, role, status, created_at, expires_at')
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return (
    <TeamClient
      orgId={orgId}
      orgName={orgName}
      myUserId={user.id}
      myRole={myRole}
      myEmail={user.email ?? ''}
      members={members ?? []}
      invitations={invitations ?? []}
    />
  )
}
