import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

async function syncGoogleToken(session) {
  if (!session?.provider_refresh_token) return
  // 每次登入把最新的 Google refresh_token 存進 profiles
  await supabase.from('profiles').update({
    google_refresh_token: session.provider_refresh_token,
    google_connected_at: new Date().toISOString(),
  }).eq('id', session.user.id)
}

export default function AuthGuard({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('[AuthGuard]', error.message)
      const s = data?.session ?? null
      setSession(s)
      syncGoogleToken(s)
    }).catch((err) => {
      console.error('[AuthGuard] fetch failed:', err.message)
      setSession(null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
      syncGoogleToken(s)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-xs text-muted-foreground font-mono tracking-widest">載入中...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}
