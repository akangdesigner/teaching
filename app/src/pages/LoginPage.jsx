import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('登入失敗：' + (error.message === 'Invalid login credentials' ? '帳號或密碼錯誤' : error.message))
      } else {
        navigate('/')
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError('註冊失敗：' + error.message)
      } else {
        setSuccess('註冊成功！請至信箱確認後再登入。')
        setMode('login')
      }
    }

    setLoading(false)
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-xl font-medium tracking-tight text-foreground mb-1">
            教學管理系統
          </h1>
          <p className="text-xs text-muted-foreground font-mono tracking-widest uppercase">
            {mode === 'login' ? '登入帳號' : '建立帳號'}
          </p>
        </div>

        <Card className="p-6 border-border bg-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-mono tracking-widest uppercase text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="teacher@example.com"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-mono tracking-widest uppercase text-muted-foreground">
                密碼
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? '至少 6 個字元' : ''}
                required
                minLength={mode === 'signup' ? 6 : undefined}
              />
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            {success && (
              <p className="text-xs text-green-500">{success}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '處理中...' : mode === 'login' ? '登入' : '建立帳號'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess('') }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {mode === 'login' ? '還沒有帳號？建立一個' : '已有帳號？直接登入'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
