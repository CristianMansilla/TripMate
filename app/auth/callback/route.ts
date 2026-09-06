import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { safeInternalPath } from '@/lib/safe-redirect'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeInternalPath(url.searchParams.get('next'))
  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = supabase
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error('Supabase no está configurado.') }
    if (error) return NextResponse.redirect(new URL('/login?error=auth_callback', url.origin))
  }
  return NextResponse.redirect(new URL(next, url.origin))
}
