import { createServerClient } from '@supabase/ssr'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Guarda los datos bancarios con el service role en vez de depender del
// update directo del cliente + RLS sobre `organizations` — esa combinación
// venía fallando en producción (0 filas afectadas, sin error) para cuentas
// owner/admin legítimas por razones que no logramos reproducir vía RLS. La
// autorización real (rol owner/admin, misma organización) se valida aquí
// en el servidor con el cliente normal antes de escribir con el admin.
export async function POST(request: Request) {
  const { orgId, bank } = await request.json()
  if (!orgId || !bank || typeof bank !== 'object') {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  }

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

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.organization_id !== orgId || !['owner', 'admin'].includes(profile.role ?? '')) {
    return NextResponse.json({ error: 'Tu usuario no tiene permiso para editar esto.' }, { status: 403 })
  }

  const adminClient = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: org } = await adminClient.from('organizations').select('settings').eq('id', orgId).single()
  const nextSettings = { ...(org?.settings ?? {}), bank_transfer: bank }
  const { error } = await adminClient.from('organizations').update({ settings: nextSettings }).eq('id', orgId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
