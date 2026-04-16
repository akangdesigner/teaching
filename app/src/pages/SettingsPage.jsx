import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import Navbar from '@/components/Navbar'
import { connectGoogle, disconnectGoogle } from '@/lib/googleSync'

export default function SettingsPage() {
  const [user, setUser] = useState(null)
  const [lineUserId, setLineUserId] = useState('')
  const [savedLineUserId, setSavedLineUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleConnectedAt, setGoogleConnectedAt] = useState(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleMsg, setGoogleMsg] = useState('')

  useEffect(() => {
    // 檢查 settings 頁面是否帶有 google=success 參數（從 callback 跳回來）
    const params = new URLSearchParams(window.location.search)
    if (params.get('google') === 'success') {
      setGoogleMsg('✓ Google Calendar 連結成功')
      window.history.replaceState({}, '', '/settings')
      setTimeout(() => setGoogleMsg(''), 5000)
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUser(data.user)
      supabase.from('profiles')
        .select('line_user_id, google_refresh_token, google_connected_at')
        .eq('id', data.user.id)
        .single()
        .then(({ data: profile }) => {
          const id = profile?.line_user_id ?? ''
          setLineUserId(id)
          setSavedLineUserId(id)
          setGoogleConnected(!!profile?.google_refresh_token)
          setGoogleConnectedAt(profile?.google_connected_at)
        })
    })
  }, [])

  async function saveLineUserId() {
    if (!user) return
    setSaving(true)
    setSaveMsg('')
    const { error } = await supabase.from('profiles')
      .update({ line_user_id: lineUserId.trim() || null })
      .eq('id', user.id)
    if (error) {
      setSaveMsg('儲存失敗：' + error.message)
    } else {
      setSavedLineUserId(lineUserId.trim())
      setSaveMsg('✓ LINE 綁定已儲存')
      setTimeout(() => setSaveMsg(''), 5000)
    }
    setSaving(false)
  }

  async function handleGoogleConnect() {
    setGoogleLoading(true)
    try {
      await connectGoogle() // will redirect, so no need to reset loading
    } catch (e) {
      setGoogleMsg('連結失敗：' + e.message)
      setGoogleLoading(false)
    }
  }

  async function handleGoogleDisconnect() {
    setGoogleLoading(true)
    setGoogleMsg('')
    try {
      await disconnectGoogle()
      setGoogleConnected(false)
      setGoogleConnectedAt(null)
      setGoogleMsg('已斷開 Google Calendar 連結')
      setTimeout(() => setGoogleMsg(''), 5000)
    } catch (e) {
      setGoogleMsg('斷開失敗：' + e.message)
    }
    setGoogleLoading(false)
  }

  return (
    <div>
      <Navbar />
      <div className="max-w-2xl mx-auto px-8 py-10 space-y-8">
        <div>
          <h1 className="text-lg font-medium tracking-tight">設定</h1>
          <p className="text-xs text-muted-foreground mt-1">帳號資訊與整合設定</p>
        </div>

        {/* 帳號資訊 */}
        <Card className="p-6 border-border bg-card space-y-4">
          <h2 className="text-xs font-mono tracking-widest uppercase text-muted-foreground">帳號資訊</h2>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm">{user?.email}</p>
          </div>
        </Card>

        <Separator />

        {/* Google Calendar */}
        <Card className="p-6 border-border bg-card space-y-5">
          <div>
            <h2 className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-1">Google Calendar 同步</h2>
            <p className="text-xs text-muted-foreground">連結後，課程時間會自動同步到 Google Calendar，在 Google 改時間也會即時反映到系統。</p>
          </div>

          {googleConnected ? (
            <div className="space-y-3">
              <div className="bg-green-500/10 border border-green-500/30 rounded px-3 py-2">
                <p className="text-xs text-green-400">已連結 Google Calendar ✓</p>
                {googleConnectedAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    連結時間：{new Date(googleConnectedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoogleDisconnect}
                disabled={googleLoading}
                className="text-xs"
              >
                {googleLoading ? '處理中...' : '斷開連結'}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGoogleConnect}
              disabled={googleLoading}
              className="w-full"
            >
              {googleLoading ? '跳轉中...' : '連結 Google Calendar'}
            </Button>
          )}

          {googleMsg && (
            <p className={`text-sm font-medium px-3 py-2 rounded ${
              googleMsg.includes('失敗')
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'bg-green-500/10 text-green-400 border border-green-500/30'
            }`}>{googleMsg}</p>
          )}
        </Card>

        <Separator />

        {/* LINE 綁定 */}
        <Card className="p-6 border-border bg-card space-y-5">
          <div>
            <h2 className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-1">LINE 通知綁定</h2>
            <p className="text-xs text-muted-foreground">綁定後，系統每天早上 8 點會推送當日課程提醒。</p>
          </div>

          {savedLineUserId && (
            <div className="bg-green-500/10 border border-green-500/30 rounded px-3 py-2">
              <p className="text-xs text-green-400">已綁定 ✓</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">{savedLineUserId}</p>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground font-medium">取得 LINE User ID 步驟：</span><br />
              1. 在 LINE 搜尋並加入課程提醒機器人<br />
              2. 傳送「<span className="font-mono text-foreground">取得我的 ID</span>」<br />
              3. 機器人回覆你的 User ID（U 開頭，33 碼）<br />
              4. 複製後貼到下方欄位並儲存
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-mono tracking-widest uppercase text-muted-foreground">
                LINE User ID
              </Label>
              <div className="flex gap-2">
                <Input
                  value={lineUserId}
                  onChange={e => setLineUserId(e.target.value)}
                  placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="font-mono text-xs"
                />
                <Button onClick={saveLineUserId} disabled={saving} className="shrink-0">
                  {saving ? '儲存中...' : '儲存'}
                </Button>
              </div>
              {saveMsg && (
                <p className={`text-sm font-medium px-3 py-2 rounded ${
                  saveMsg.startsWith('儲存失敗')
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                    : 'bg-green-500/10 text-green-400 border border-green-500/30'
                }`}>{saveMsg}</p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
