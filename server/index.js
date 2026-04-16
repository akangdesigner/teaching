import express from 'express'
import cors from 'cors'
import { startReminderCron } from './services/reminder.js'
import webhookRouter from './routes/webhook.js'
import googleSyncRouter from './routes/googleSync.js'
import googleWebhookRouter from './routes/googleWebhook.js'
import { registerWebhook } from './services/googleCalendar.js'
import { supabase } from './services/supabase.js'

const app = express()
const PORT = process.env.PORT || 3000
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://qktutormanagement.zeabur.app'

app.use(cors({ origin: FRONTEND_URL }))
app.use(express.json())

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// LINE webhook
app.use('/webhook', webhookRouter)

// Google Calendar sync API (called by frontend after saving)
app.use('/api/google', googleSyncRouter)

// Google Calendar push notifications
app.use('/webhook/google-calendar', googleWebhookRouter)

app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`)
  startReminderCron()
  ensureWebhooks()
})

// 啟動時替所有已連結 Google 的用戶確保 webhook 存在
async function ensureWebhooks() {
  if (!process.env.SERVER_URL) return

  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .not('google_refresh_token', 'is', null)

    for (const profile of profiles || []) {
      const { data: channels } = await supabase
        .from('google_calendar_channels')
        .select('expiration')
        .eq('user_id', profile.id)

      const hasActive = channels?.some(
        c => new Date(c.expiration) > new Date(Date.now() + 24 * 60 * 60 * 1000)
      )

      if (!hasActive) {
        await registerWebhook(profile.id).catch(e =>
          console.warn(`[webhook] user ${profile.id} 註冊失敗:`, e.message)
        )
      }
    }
    console.log('[webhook] 所有用戶 webhook 確認完畢')
  } catch (e) {
    console.error('[webhook] ensureWebhooks 失敗:', e.message)
  }
}
