import { Router } from 'express'
import { supabase } from '../services/supabase.js'
import {
  exchangeCode,
  getAuthUrl,
  registerWebhook,
  stopWebhook,
} from '../services/googleCalendar.js'

const router = Router()
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://qktutormanagement.zeabur.app'

// 前端用來取得 Google OAuth URL
router.get('/url', (req, res) => {
  res.json({ url: getAuthUrl() })
})

// 前端拿到 code 後，POST 到這裡完成連結
router.post('/connect', async (req, res) => {
  const { code } = req.body
  const jwt = req.headers.authorization?.replace('Bearer ', '')

  if (!code || !jwt) return res.status(400).json({ error: 'Missing code or token' })

  // 驗證 JWT，取得 user_id
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const tokens = await exchangeCode(code)

    await supabase.from('profiles').update({
      google_refresh_token: tokens.refresh_token,
      google_connected_at: new Date().toISOString(),
      google_sync_token: null,
    }).eq('id', user.id)

    // 嘗試設定 webhook（需要 SERVER_URL 環境變數）
    try {
      await registerWebhook(user.id)
    } catch (e) {
      console.warn('[google] webhook 註冊失敗（可能 SERVER_URL 未設定）:', e.message)
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('[google] connect error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// 斷開連結
router.post('/disconnect', async (req, res) => {
  const jwt = req.headers.authorization?.replace('Bearer ', '')
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' })

  try {
    await stopWebhook(user.id)
    await supabase.from('profiles').update({
      google_refresh_token: null,
      google_connected_at: null,
      google_sync_token: null,
    }).eq('id', user.id)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
