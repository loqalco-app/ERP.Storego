import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.STORE_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// DELETE /api/store/reserve/:id?session_id=xxx
// Releases a pending reservation (cart removal or session end)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400, headers: corsHeaders })

  const { error } = await getClient()
    .from('inventory_reservations')
    .update({ status: 'released', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('session_id', sessionId)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: 'release_failed' }, { status: 500, headers: corsHeaders })
  return NextResponse.json({ released: true }, { headers: corsHeaders })
}

export const dynamic = 'force-dynamic'
