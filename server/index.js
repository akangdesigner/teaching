import express from 'express'
import cors from 'cors'
import { startReminderCron } from './services/reminder.js'
import webhookRouter from './routes/webhook.js'
import googleAuthRouter from './routes/googleAuth.js'
import googleSyncRouter from './routes/googleSync.js'
import googleWebhookRouter from './routes/googleWebhook.js'

const app = express()
const PORT = process.env.PORT || 3000
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://qktutormanagement.zeabur.app'

app.use(cors({ origin: FRONTEND_URL }))
app.use(express.json())

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// LINE webhook
app.use('/webhook', webhookRouter)

// Google Calendar
app.use('/api/google', googleAuthRouter)
app.use('/api/google', googleSyncRouter)
app.use('/webhook/google-calendar', googleWebhookRouter)

app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`)
  startReminderCron()
})
