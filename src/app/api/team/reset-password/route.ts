import { createServerClient } from '@supabase/ssr'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// POST /api/team/reset-password
// Returns a one-time recovery link so the admin can share it via WhatsApp
export async function POST(request: Request) {
  const { memberId, orgId } = await request.json()
  if (!memberId || !orgId) return NextResponse.json({ error: 'Faltan campos.' }, { status: 400 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado.' }, { status: 500 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!callerProfile || callerProfile.organization_id !== orgId || !['owner', 'admin'].includes(callerProfile.role ?? '')) {
    return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
  }

  const adminClient = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get member's email from auth
  const { data: memberAuth, error: fetchErr } = await adminClient.auth.admin.getUserById(memberId)
  if (fetchErr || !memberAuth?.user?.email) {
    return NextResponse.json({ error: 'No se encontró el usuario.' }, { status: 404 })
  }

  // Verify member belongs to this org
  const { data: memberProfile } = await adminClient
    .from('user_profiles')
    .select('organization_id')
    .eq('id', memberId)
    .single()

  if (!memberProfile || memberProfile.organization_id !== orgId) {
    return NextResponse.json({ error: 'Usuario no pertenece a esta organización.' }, { status: 403 })
  }

  // Generate a one-time recovery link
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: memberAuth.user.email,
  })

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkErr?.message ?? 'Error al generar el link.' }, { status: 500 })
  }

  return NextResponse.json({ link: linkData.properties.action_link, email: memberAuth.user.email })
}
