import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.events',
        queryParams: { access_type: 'offline', prompt: 'consent' },
        redirectTo: window.location.origin,
      },
    })
    if (error) {
      setError('登入失敗：' + error.message)
      setLoading(false)
    }
    // 成功會 redirect，不需要處理
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-xl font-medium tracking-tight text-foreground mb-1">
            教學管理系統
          </h1>
          <p className="text-xs text-muted-foreground font-mono tracking-widest uppercase">
            登入帳號
          </p>
        </div>

        <Card className="p-6 border-border bg-card space-y-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center gap-3"
          >
            {!loading && (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
              </svg>
            )}
            {loading ? '跳轉中...' : '使用 Google 帳號登入'}
          </Button>

          {error && <p className="text-xs text-destructive text-center">{error}</p>}

          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            登入即授權系統存取您的 Google Calendar，<br />用於課程時間雙向同步。
          </p>
        </Card>
      </div>
    </div>
  )
}
