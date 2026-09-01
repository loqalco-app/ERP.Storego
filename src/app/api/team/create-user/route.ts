import { createServerClient } from '@supabase/ssr'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, fullName, role, password, orgId } = await request.json()

  if (!email || !fullName || !role || !password || !orgId) {
    return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 })
  }
  if (!['admin', 'staff', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado.' }, { status: 500 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  // Verify caller is admin/owner of the org
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (
    !callerProfile ||
    callerProfile.organization_id !== orgId ||
    !['owner', 'admin'].includes(callerProfile.role ?? '')
  ) {
    return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
  }

  const adminClient = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Create user — trigger handle_invited_user will create user_profiles entry
  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
    user_metadata: { org_id: orgId, role, full_name: fullName.trim() },
  })

  if (createErr || !newUser?.user) {
    const msg = createErr?.message ?? ''
    if (msg.includes('already been registered') || msg.includes('already exists')) {
      return NextResponse.json({ error: 'Ese correo ya está registrado.' }, { status: 409 })
    }
    return NextResponse.json({ error: msg || 'Error al crear usuario.' }, { status: 400 })
  }

  // The trigger may not fire instantly in all environments, so upsert the profile
  await adminClient.from('user_profiles').upsert({
    id: newUser.user.id,
    organization_id: orgId,
    full_name: fullName.trim(),
    role,
    status: 'active',
    must_change_password: true,
  }, { onConflict: 'id' })

  return NextResponse.json({ ok: true })
}
