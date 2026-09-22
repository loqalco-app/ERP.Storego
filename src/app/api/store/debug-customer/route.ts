import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// TEMP DIAGNOSTIC ROUTE — remove after debugging the missing-address issue.
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
  const client = getClient()
  const { data: customers, error: cErr } = await client
    .from('customers')
    .select('id, full_name, email, phone, organization_id, created_at')
    .eq('email', email.toLowerCase())
  const ids = (customers ?? []).map(c => c.id)
  const { data: addresses, error: aErr } = ids.length
    ? await client.from('customer_addresses').select('*').in('customer_id', ids)
    : { data: [], error: null }
  return NextResponse.json({ customers, addresses, cErr, aErr })
}

export const dynamic = 'force-dynamic'
