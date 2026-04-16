import { google } from 'googleapis'
import { supabase } from './supabase.js'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://qktutormanagement.zeabur.app'
const SERVER_URL = process.env.SERVER_URL || ''

export function createOAuth2Client(tokens = {}) {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    `${FRONTEND_URL}/auth/google/callback`
  )
  if (tokens.refresh_token || tokens.access_token) {
    oauth2Client.setCredentials(tokens)
  }
  return oauth2Client
}

export function getAuthUrl() {
  const oauth2Client = createOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  })
}

export async function exchangeCode(code) {
  const oauth2Client = createOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

async function getCalendarClient(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_refresh_token, google_calendar_id')
    .eq('id', userId)
    .single()

  if (!profile?.google_refresh_token) throw new Error('Google Calendar 未連結')

  const oauth2Client = createOAuth2Client({
    refresh_token: profile.google_refresh_token,
  })
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  return { calendar, calendarId: profile.google_calendar_id || 'primary' }
}

// 建立或更新 Google Calendar 事件（1 小時）
export async function upsertEvent(userId, { googleEventId, summary, description, startIso }) {
  const { calendar, calendarId } = await getCalendarClient(userId)

  const start = new Date(startIso)
  const end = new Date(start.getTime() + 60 * 60 * 1000) // +1hr

  const eventBody = {
    summary,
    description: description || '',
    start: { dateTime: start.toISOString(), timeZone: 'Asia/Taipei' },
    end: { dateTime: end.toISOString(), timeZone: 'Asia/Taipei' },
  }

  if (googleEventId) {
    const { data } = await calendar.events.patch({
      calendarId,
      eventId: googleEventId,
      requestBody: eventBody,
    })
    return data
  } else {
    const { data } = await calendar.events.insert({
      calendarId,
      requestBody: eventBody,
    })
    return data
  }
}

export async function deleteEvent(userId, googleEventId) {
  if (!googleEventId) return
  const { calendar, calendarId } = await getCalendarClient(userId)
  try {
    await calendar.events.delete({ calendarId, eventId: googleEventId })
  } catch (e) {
    if (e.code !== 410 && e.code !== 404) throw e // ignore already-deleted
  }
}

// 取得最近更新的事件（用 syncToken 做增量同步）
export async function fetchChangedEvents(userId) {
  const { calendar, calendarId } = await getCalendarClient(userId)

  const { data: profile } = await supabase
    .from('profiles')
    .select('google_sync_token')
    .eq('id', userId)
    .single()

  let events = []
  let nextSyncToken = null

  try {
    const params = { calendarId, singleEvents: true }
    if (profile?.google_sync_token) {
      params.syncToken = profile.google_sync_token
    } else {
      // 首次同步：只抓未來 90 天
      params.timeMin = new Date().toISOString()
      params.timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    }

    const { data } = await calendar.events.list(params)
    events = data.items || []
    nextSyncToken = data.nextSyncToken
  } catch (e) {
    if (e.code === 410) {
      // syncToken 過期，清掉重來
      await supabase.from('profiles').update({ google_sync_token: null }).eq('id', userId)
      return fetchChangedEvents(userId)
    }
    throw e
  }

  if (nextSyncToken) {
    await supabase.from('profiles').update({ google_sync_token: nextSyncToken }).eq('id', userId)
  }

  return events
}

// 向 Google 註冊 webhook channel（有效期約 7 天，需定期更新）
export async function registerWebhook(userId) {
  if (!SERVER_URL) return null

  const { calendar, calendarId } = await getCalendarClient(userId)
  const channelId = `teaching-${userId}-${Date.now()}`

  const { data } = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: `${SERVER_URL}/webhook/google-calendar`,
      token: userId, // 用來識別是哪個用戶
    },
  })

  // 記錄 channel 資訊
  await supabase.from('google_calendar_channels').upsert({
    user_id: userId,
    channel_id: channelId,
    resource_id: data.resourceId,
    expiration: new Date(parseInt(data.expiration)).toISOString(),
  }, { onConflict: 'channel_id' })

  return data
}

// 停止 webhook channel
export async function stopWebhook(userId) {
  const { data: channels } = await supabase
    .from('google_calendar_channels')
    .select('*')
    .eq('user_id', userId)

  if (!channels?.length) return

  const oauth2Client = createOAuth2Client({
    refresh_token: (await supabase.from('profiles').select('google_refresh_token').eq('id', userId).single()).data?.google_refresh_token
  })
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  for (const ch of channels) {
    try {
      await calendar.channels.stop({
        requestBody: { id: ch.channel_id, resourceId: ch.resource_id },
      })
    } catch {}
  }

  await supabase.from('google_calendar_channels').delete().eq('user_id', userId)
}
