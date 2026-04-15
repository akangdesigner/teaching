import { Router } from 'express'
import { supabase } from '../services/supabase.js'
import { replyMessage } from '../services/line.js'

const router = Router()

const STAGE_LABEL = {
  preparation: '準備階段',
  stage1: '第一階段｜諮詢',
  stage2: '第二階段｜課程',
  stage3: '第三階段｜成果',
  completed: '已完成',
}

function formatDateTime(iso) {
  if (!iso) return '未設定'
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric', day: 'numeric',
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// Look up teacher's user_id by LINE User ID
async function getTeacherUserId(lineUserId) {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('line_user_id', lineUserId)
    .single()
  return data?.id ?? null
}

// Handler: return User ID to LINE user
async function handleGetId(replyToken, lineUserId) {
  await replyMessage(replyToken,
    `你的 LINE User ID 是：\n${lineUserId}\n\n請複製後貼到教學管理系統的「設定」頁面，完成綁定。`
  )
}

// Handler: query student by name
async function handleStudentQuery(replyToken, userId, studentName) {
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `%${studentName}%`)
    .order('created_at')

  if (!clients || clients.length === 0) {
    return replyMessage(replyToken, `找不到「${studentName}」，請確認姓名是否正確。`)
  }

  const c = clients[0]

  // Get incomplete tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('description')
    .eq('client_id', c.id)
    .eq('completed', false)
    .order('created_at')

  // Get last session
  const { data: sessions } = await supabase
    .from('sessions')
    .select('session_number, progress')
    .eq('client_id', c.id)
    .order('session_number', { ascending: false })
    .limit(1)

  const lines = [
    `👤 ${c.name}`,
    `專案：${c.project_name ?? '未設定'}`,
    `階段：${STAGE_LABEL[c.current_stage] ?? c.current_stage}`,
    `下次上課：${formatDateTime(c.next_session_date)}`,
  ]

  if (c.situation) lines.push(`\n狀況：${c.situation}`)

  if (c.goals?.length > 0) {
    lines.push('\n學習目標：')
    c.goals.forEach((g, i) => lines.push(`  ${i + 1}. ${g}`))
  }

  const pending = tasks ?? []
  if (pending.length > 0) {
    lines.push(`\n⚠️ 未完成作業（${pending.length}）：`)
    pending.slice(0, 5).forEach(t => lines.push(`  · ${t.description}`))
    if (pending.length > 5) lines.push(`  …還有 ${pending.length - 5} 項`)
  } else {
    lines.push('\n✅ 所有作業已完成')
  }

  const lastSession = sessions?.[0]
  if (lastSession) {
    lines.push(`\n最近課程（第 ${lastSession.session_number} 堂）：`)
    if (lastSession.progress) {
      const preview = lastSession.progress.slice(0, 80)
      lines.push(`  ${preview}${lastSession.progress.length > 80 ? '…' : ''}`)
    }
  }

  if (clients.length > 1) {
    lines.push(`\n（另有 ${clients.length - 1} 位同名學生，已顯示第一位）`)
  }

  await replyMessage(replyToken, lines.join('\n'))
}

// Handler: today's sessions
async function handleToday(replyToken, userId) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)

  const { data: clients } = await supabase
    .from('clients')
    .select('name, project_name, current_stage, next_session_date')
    .eq('user_id', userId)
    .gte('next_session_date', start.toISOString())
    .lt('next_session_date', end.toISOString())
    .order('next_session_date')

  if (!clients || clients.length === 0) {
    return replyMessage(replyToken, '今日沒有排定的課程 🙌')
  }

  const lines = [`📅 今日課程 × ${clients.length}`, '─────────────']
  for (const c of clients) {
    const time = new Date(c.next_session_date).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit',
    })
    lines.push(`\n${time}  ${c.name}`)
    lines.push(`  ${c.project_name ?? ''}`)
    lines.push(`  ${STAGE_LABEL[c.current_stage] ?? c.current_stage}`)
  }

  await replyMessage(replyToken, lines.join('\n'))
}

// Handler: this week's sessions
async function handleWeek(replyToken, userId) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 7)

  const { data: clients } = await supabase
    .from('clients')
    .select('name, project_name, current_stage, next_session_date')
    .eq('user_id', userId)
    .gte('next_session_date', start.toISOString())
    .lt('next_session_date', end.toISOString())
    .order('next_session_date')

  if (!clients || clients.length === 0) {
    return replyMessage(replyToken, '本週沒有排定的課程 🙌')
  }

  const lines = [`📅 本週課程 × ${clients.length}`, '─────────────']
  for (const c of clients) {
    lines.push(`\n${formatDateTime(c.next_session_date)}  ${c.name}`)
    lines.push(`  ${c.project_name ?? ''}`)
    lines.push(`  ${STAGE_LABEL[c.current_stage] ?? c.current_stage}`)
  }

  await replyMessage(replyToken, lines.join('\n'))
}

const HELP_TEXT = `課程提醒機器人指令：

• 取得我的 ID
  取得你的 LINE User ID（用於系統設定）

• 查詢 [姓名]
  查看學生資料、作業、課程進度

• 今日課程
  今天所有排定的課程

• 本週課程
  未來 7 天的課程總覽

• 說明
  顯示此說明`

// Main webhook handler
router.post('/line', async (req, res) => {
  res.sendStatus(200) // Respond immediately to LINE

  const events = req.body?.events ?? []

  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue

    const text = event.message.text.trim()
    const replyToken = event.replyToken
    const lineUserId = event.source?.userId

    if (!lineUserId || !replyToken) continue

    try {
      console.log(`[webhook] userId=${lineUserId} text="${text}"`)

      // Always allow "取得我的 ID" without auth（大小寫不敏感）
      if (text.replace(/\s/g, '').toLowerCase() === '取得我的id' || text.toLowerCase() === 'get my id') {
        await handleGetId(replyToken, lineUserId)
        continue
      }

      // All other commands require teacher to be bound
      const teacherUserId = await getTeacherUserId(lineUserId)
      if (!teacherUserId) {
        await replyMessage(replyToken,
          '你尚未綁定帳號。\n請先傳「取得我的 ID」，再到系統設定頁面完成綁定。'
        )
        continue
      }

      if (text.startsWith('查詢 ') || text.startsWith('查询 ')) {
        const name = text.replace(/^查[詢询]\s+/, '').trim()
        await handleStudentQuery(replyToken, teacherUserId, name)
      } else if (text === '今日課程' || text === '今日课程') {
        await handleToday(replyToken, teacherUserId)
      } else if (text === '本週課程' || text === '本周課程' || text === '本周课程') {
        await handleWeek(replyToken, teacherUserId)
      } else if (text === '說明' || text === '指令' || text === 'help') {
        await replyMessage(replyToken, HELP_TEXT)
      } else {
        await replyMessage(replyToken, `不認識這個指令。\n傳「說明」查看所有可用指令。`)
      }
    } catch (err) {
      console.error('[webhook] Error handling event:', err.message)
    }
  }
})

export default router
