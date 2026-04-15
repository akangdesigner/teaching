const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_PROMPT = `你是一個教學管理系統的 AI 助理，負責解析教師給的諮詢或課程紀錄，並產生對應的資料庫操作清單。

## 資料庫 Schema

### clients（個案主表）
- name: text（姓名）
- project_name: text（學習專案名稱）
- current_stage: 'preparation' | 'stage1' | 'stage2' | 'stage3' | 'completed'
- personality: text（性格特質）
- situation: text（目前狀況）
- skills: text（技術背景）
- goals: text[]（學習目標，陣列）
- next_session_date: timestamptz（ISO 8601 格式，台灣時間 UTC+8）

### consultations（第一階段：模擬諮詢，對應 stage1）
- date: timestamptz
- summary: text（本次諮詢摘要）
- tech_level: 'beginner' | 'intermediate' | 'advanced'
- weekly_hours: text（每週可投入時間）
- tools: text（目前使用或熟悉的工具）
- project_proposals: text[]（提案方向，陣列）
- next_session_date: timestamptz（下次上課時間）
- notes: text（其他備注）

### sessions（第二階段：每次課程紀錄，對應 stage2）
- session_number: integer（第幾堂課）
- date: timestamptz
- objectives: text（本堂課目標）
- progress: text（課程進度與完成情況）
- notes: text（備注）

### tasks（作業清單）
- description: text（作業描述）
- source: 'stage1' | 'session'（來源：stage1 諮詢或 session 課程）

## 可執行的操作類型（actions）

1. **insert_client** — 新增個案（僅新學生時使用）
   - data: { name, project_name?, current_stage, personality?, situation?, skills?, goals?, next_session_date? }

2. **update_client** — 更新個案主表（已有個案時使用）
   - data: { current_stage?, next_session_date? }

3. **insert_consultation** — 新增諮詢紀錄（stage1 用）
   - data: { date, summary, tech_level, weekly_hours, tools, project_proposals, next_session_date, notes }

4. **insert_session** — 新增課程紀錄（stage2 用）
   - data: { session_number, date, objectives, progress, notes }

5. **insert_tasks** — 新增作業
   - data: [{ description, source }]

## 判斷規則

### 新學生
- 第一個 action 必須是 insert_client（含 current_stage: 'stage1'），再加 insert_consultation 和 insert_tasks

### 已有個案（這是本次課程剛結束的內容，要往下推進階段）

依據個案目前的 current_stage 決定操作：

| 目前階段 | 代表意義 | 要做的操作 |
|----------|----------|-----------|
| preparation | 這是第一次模擬諮詢（30min）剛結束 | insert_consultation + update_client(current_stage: 'stage1') |
| stage1 | 這是第一堂正式課程（1hr）剛結束 | insert_session(session_number: 1) + update_client(current_stage: 'stage2') |
| stage2 | 這是又一堂正式課程剛結束 | insert_session（session_number 從紀錄推算或留給使用者補）+ update_client（next_session_date 有提到才更新） |
| stage3 | 成果報告階段 | update_client 視情況更新 |

- 若有提到作業 → 產生 insert_tasks
- 若紀錄中有明確提到下次上課時間 → 在 update_client 裡更新 next_session_date
- 今天日期：${new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}

## 輸出格式（必須是 JSON）

{
  "summary": "一句話說明本次解析結果",
  "actions": [
    {
      "type": "操作類型",
      "description": "這個操作的中文說明",
      "data": { ... }
    }
  ]
}

注意：
- 時間格式統一用 ISO 8601，例如 "2026-04-08T20:00:00+08:00"
- 若紀錄中某欄位沒有提到，就省略該欄位（不要填 null 或空字串）
- 只產生有根據的操作，不要猜測或捏造資料
- 只回傳純 JSON，不要加 markdown code block（不要用 \`\`\`json）`

export async function generateConsultationReport({ client, consultation, tasks }) {
  const toDateStr = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    const y = d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric' }).replace('年', '')
    const m = String(d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric' }).replace('月', '')).padStart(2, '0')
    const day = String(d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', day: 'numeric' }).replace('日', '')).padStart(2, '0')
    return `${y}/${m}/${day}`
  }

  const consultationDateStr = toDateStr(consultation?.date) ?? '（未填）'
  const titleDate = consultation?.date
    ? (() => { const d = new Date(consultation.date); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` })()
    : '??/??'
  const nextSessionStr = toDateStr(client?.next_session_date)

  const doneTasks = tasks.filter(t => t.completed).map(t => t.description)
  const pendingTasks = tasks.filter(t => !t.completed).map(t => t.description)

  const context = `
個案姓名：${client.name}
學習專案：${client.project_name ?? '（未填）'}
學習目標：${(client.goals ?? []).join('、') || '（未填）'}
技術背景：${client.skills ?? '（未填）'}
目前狀況：${client.situation ?? '（未填）'}

【關鍵日期】
- 諮詢日期（時程起點）：${consultationDateStr}
- 下次上課日期：${nextSessionStr ?? '（未填）'}

諮詢摘要：${consultation?.summary ?? '（未填）'}
主軸工具：${consultation?.tools ?? '（未填）'}
每週可投入時間：${consultation?.weekly_hours ?? '（未填）'}
技術程度：${{ beginner: '初學', intermediate: '有基礎', advanced: '進階' }[consultation?.tech_level] ?? '（未填）'}
專案提案：${(consultation?.project_proposals ?? []).join('、') || '（未填）'}
備註：${consultation?.notes ?? '（未填）'}

已完成作業：${doneTasks.length > 0 ? doneTasks.join('、') : '無'}
待完成作業：${pendingTasks.length > 0 ? pendingTasks.join('、') : '無'}
`.trim()

  const prompt = `根據以下個案資料，生成一份「第一階段諮詢紀錄報告」。

${context}

請嚴格按照以下格式輸出（純文字，不要 markdown 符號如 **、##）：

標題：🟢 ${titleDate} 第一階段諮詢紀錄 #01
【專案類型標籤】${consultationDateStr} - （從諮詢日期起，依每週時間與難度推算整體結束日期）
專案題目：（填入專案名稱）
所需技能：（填入相關工具與技能）
呈現技法：（填入主要交付成果項目）
上次任務回顧
（列出已完成的作業，每條以 -> 開頭說明完成狀況；若無已完成則寫「初次諮詢，無前次任務」）
專案進度討論
【專案類型標籤】${consultationDateStr} - （同上結束日期）
專案題目：（同上）
所需技能：（同上）
呈現技法：（同上）
時程規劃：${consultationDateStr} - （結束日期）
（從 ${consultationDateStr} 開始，列出每個階段的具體日期區間，每行格式：YYYY/MM/DD - YYYY/MM/DD 任務名稱）
預期成果：（根據學習目標填入）
（針對前幾個重要階段，各寫一段 ➤ 開頭的討論重點）
本次任務指派
（列出待完成的作業，每條一行${nextSessionStr ? `，任務區間從下次上課 ${nextSessionStr} 往前推` : ''}）

注意：
- 所有日期必須以 ${consultationDateStr} 為起點推算，不可使用其他日期
- 日期格式統一用 YYYY/MM/DD
- 只輸出純文字報告，不要任何額外說明`

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || '呼叫 Groq API 失敗')
  }

  const result = await response.json()
  const text = result.choices?.[0]?.message?.content
  if (!text) throw new Error('Groq 沒有回傳內容')
  return text.trim()
}

export async function generateSessionReport({ client, consultation, tasks, sessionNumber, todayStr }) {
  const doneTasks = tasks.filter(t => t.completed)
  const pendingTasks = tasks.filter(t => !t.completed)

  const toDateStr = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    const y = d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric' }).replace('年', '')
    const m = String(d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric' }).replace('月', '')).padStart(2, '0')
    const day = String(d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', day: 'numeric' }).replace('日', '')).padStart(2, '0')
    return `${y}/${m}/${day}`
  }

  const nextSessionStr = toDateStr(client?.next_session_date)
  const titleDate = todayStr  // MM/DD 格式由呼叫端傳入

  const taskLines = [
    ...doneTasks.map(t => `[已完成] ${t.description}`),
    ...pendingTasks.map(t => `[待完成] ${t.description}`),
  ].join('\n') || '（無作業紀錄）'

  const context = `
個案姓名：${client.name}
學習專案：${client.project_name ?? '（未填）'}
學習目標：${(client.goals ?? []).join('、') || '（未填）'}
技術背景：${client.skills ?? '（未填）'}
第一階段諮詢摘要：${consultation?.summary ?? '（未填）'}
主軸工具：${consultation?.tools ?? '（未填）'}
每週可投入時間：${consultation?.weekly_hours ?? '（未填）'}
技術程度：${{ beginner: '初學', intermediate: '有基礎', advanced: '進階' }[consultation?.tech_level] ?? '（未填）'}

【上次（第一階段諮詢）指派的作業】
${taskLines}

今天日期：${todayStr}
今天堂次：第 ${sessionNumber} 堂（第一堂正式課）
下次上課時間：${nextSessionStr ?? '（未填）'}
`.trim()

  const prompt = `根據以下個案資料，生成一份「今天第二階段課程的課前準備報告」。

${context}

這份報告的目的是：在課程開始前整理上次諮詢後的作業狀況，本次任務指派欄位留白（課後才填）。

請嚴格按照以下格式輸出（純文字，不要 markdown 符號如 **、##）：

標題：🔵 ${titleDate} 第二階段課程紀錄 #${String(sessionNumber).padStart(2, '0')}
專案題目：（填入專案名稱）
所需技能：（根據工具與技術背景填入）

上次任務回顧
（列出每條作業的狀況，已完成的以 -> ✓ 開頭，待完成的以 -> ○ 開頭，說明任務內容）

課程進度討論
（根據個案背景與學習目標，條列今天第一堂課預計討論的重點，每條以 ➤ 開頭）

本次任務指派
（課後補充）
${nextSessionStr ? `\n下次上課時間：${nextSessionStr}` : ''}

注意：
- 日期格式統一用 YYYY/MM/DD
- 只輸出純文字報告，不要任何額外說明`

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || '呼叫 Groq API 失敗')
  }

  const result = await response.json()
  const text = result.choices?.[0]?.message?.content
  if (!text) throw new Error('Groq 沒有回傳內容')
  return text.trim()
}

export async function parseSessionNotes({ clientName, currentStage, notes, isNew, stageHint }) {
  // stageHint: 'profile' | 'consultation' | 'session'

  let userMessage

  if (isNew) {
    userMessage = `這是一位【新學生】，尚未建立個案。

以下是學生的基本資料，請解析並產生：
- insert_client（current_stage: 'preparation'，填入 name、project_name、personality、situation、skills、goals 等）

---
${notes}
---`
  } else if (stageHint === 'profile') {
    userMessage = `個案姓名：${clientName}

【更新學生背景資料】只需產生 update_client 操作，填入有提到的欄位：
- name、project_name、personality、situation、skills、goals
- next_session_date：若紀錄中有提到「下次諮詢時間」、「第一次上課時間」、「預約時間」等，統一對應到此欄位（ISO 8601 格式，台灣時間 UTC+8）

不要新增諮詢或課程紀錄。

---
${notes}
---`
  } else if (stageHint === 'consultation') {
    userMessage = `個案姓名：${clientName}

【第一階段模擬諮詢剛結束】請產生：
- insert_consultation（填入 summary、tech_level、weekly_hours、tools、project_proposals、notes；date 只在紀錄中有明確提到諮詢時間時才填，否則省略；next_session_date 只在有明確提到下次上課時間時才填）
- update_client（current_stage: 'stage1'，若有 next_session_date 也一起更新）
- insert_tasks（若有提到作業，source: 'stage1'）

重要：date 與 next_session_date 請勿自行推斷或填今天日期，只有紀錄中明確寫出時間才填入。

---
${notes}
---`
  } else if (stageHint === 'session') {
    userMessage = `個案姓名：${clientName}
目前階段：${currentStage}

【第二階段課程剛結束】請產生：
- insert_session（填入 session_number、objectives、progress、notes；date 只在紀錄中有明確提到時間時才填，否則省略）
- update_client（current_stage: 'stage2'，若有提到下次上課時間則更新 next_session_date）
- insert_tasks（若有提到作業，source: 'session'）

重要：date 欄位請勿自行推斷或填今天日期，只有紀錄中明確寫出上課時間才填入。

---
${notes}
---`
  } else {
    userMessage = `個案姓名：${clientName}
目前階段：${currentStage}

【這是本次課程剛結束的紀錄】，請根據目前階段往下推進，並產生對應的操作清單：

---
${notes}
---`
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || '呼叫 Groq API 失敗')
  }

  const result = await response.json()
  const text = result.choices?.[0]?.message?.content
  if (!text) throw new Error('Groq 沒有回傳內容')

  return JSON.parse(text)
}
