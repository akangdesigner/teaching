import express from 'express'
import { startReminderCron } from './services/reminder.js'
import webhookRouter from './routes/webhook.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// LINE webhook
app.use('/webhook', webhookRouter)

app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`)
  startReminderCron()
})
