import pptxgen from 'pptxgenjs'

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const COLORS = {
  primary: '4F46E5',
  accent: '7C3AED',
  cyan: '0891B2',
  text: '111827',
  muted: '6B7280',
  light: 'F3F4F6',
  lightBlue: 'EEF2FF',
  lightPurple: 'F5F3FF',
  lightGreen: 'ECFDF5',
  lightAmber: 'FFFBEB',
  border: 'E5E7EB',
  done: '059669',
  pending: 'D97706',
  white: 'FFFFFF',
  dark: '1E1B4B',
}

// ── AI 生成投影片內容（大幅強化 prompt）────────────────────────
async function generateSlideContent({ client, sessions, tasks, consultation }) {
  const lastSession = sessions[sessions.length - 1]
  const allSessions = sessions
  const pendingTasks = tasks.filter(t => !t.completed)
  const doneTasks = tasks.filter(t => t.completed)
  const projectGoals = (client.goals || [])

  const prompt = `你是一位資深 AI 課程設計師，專門協助教師為學員準備高品質教材。
請根據以下完整的學員資料，產生一份有深度的課程規劃 JSON。

═══════════════════════════════
學員基本資料
═══════════════════════════════
姓名：${client.name}
專案名稱：${client.project_name}
目前階段：${client.current_stage}
技術背景：${client.skills || '未填寫'}
目前狀況：${client.situation || '未填寫'}
性格特質：${client.personality || '未填寫'}

═══════════════════════════════
學員的【專案目標】（這是最重要的依據）
═══════════════════════════════
${projectGoals.length > 0
  ? projectGoals.map((g, i) => `目標 ${i + 1}：${g}`).join('\n')
  : '（尚未設定目標）'}

═══════════════════════════════
課程歷程（${allSessions.length} 堂課）
═══════════════════════════════
${allSessions.length === 0 ? '尚未上過課' : allSessions.map(s => `
【第 ${s.session_number} 堂課】${s.date}
  目標：${s.objectives}
  進度：${s.progress}
  備注：${s.notes || '無'}`).join('\n')}

═══════════════════════════════
作業狀況
═══════════════════════════════
已完成（${doneTasks.length} 項）：
${doneTasks.map(t => `  ✓ ${t.description}`).join('\n') || '  無'}

待完成（${pendingTasks.length} 項）：
${pendingTasks.map(t => `  ○ ${t.description}`).join('\n') || '  無'}

═══════════════════════════════
你的任務
═══════════════════════════════

請輸出以下 JSON（全部用繁體中文）：

{
  "progress_summary": "根據課程歷程和作業完成度，用 2-3 句話總結學員目前的整體進度和能力狀態",

  "goals": [
    {
      "title": "目標標題（8字以內）",
      "detail": "這堂課要完成的具體任務是什麼、達成標準是什麼（2-3句，要具體到可以驗收）",
      "linked_project_goal": "直接引用學員學習目標的原文（例如：成為教會資訊人員，建立 AI 行政助理系統）",
      "why_now": "這個任務完成後，對達成該學習目標有什麼推進（1句）"
    },
    { 同上格式 },
    { 同上格式 }
  ],

  "teaching_modules": [
    {
      "title": "教學模組標題",
      "objective": "本模組的學習目標（學員上完這個模組能做到什麼）",
      "duration": "預估時間，例如 20 分鐘",
      "steps": [
        "步驟一：具體操作說明",
        "步驟二：具體操作說明",
        "步驟三：具體操作說明"
      ],
      "key_concept": "這個模組最核心的概念或技巧（1句，要讓學員記住的）",
      "common_mistake": "學員最容易犯的錯誤或卡關點（1句）"
    },
    { 同上格式，第二個模組 },
    { 同上格式，第三個模組 }
  ],

  "next_steps": [
    {
      "action": "行動項目（具體可執行）",
      "purpose": "做這件事的原因或預期效果",
      "timeframe": "建議完成時間，例如：下次上課前、本週內"
    },
    { 同上格式 },
    { 同上格式 }
  ]
}

重要規則：
1. goals 的 linked_project_goal 必須原文引用學員的【學習目標】清單，每個 goal 對應一個不同的學習目標
2. goals 的 detail 要說明「這堂課要做什麼具體任務」，讓人能驗收是否達成
3. 如果學習目標只有 1-2 個，可以把同一個目標拆成不同階段的子任務
4. teaching_modules 的 steps 要具體到「打開 X、點選 Y、輸入 Z」的層級
5. next_steps 的 action 要是學員回家可以馬上做的事
6. 根據學員技術背景調整難度（${client.skills || '初學者'}）
7. 只回傳純 JSON，不加任何說明文字`

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || '呼叫 AI 失敗')
  }

  const result = await response.json()
  const text = result.choices?.[0]?.message?.content
  if (!text) throw new Error('AI 沒有回傳內容')
  return JSON.parse(text)
}

// ── 輔助：加頁首 ──────────────────────────────────────────────
function addHeader(slide, title, slideNum, total) {
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.7, fill: { color: COLORS.dark } })
  slide.addText(title, {
    x: 0.5, y: 0.1, w: 8, h: 0.5,
    fontSize: 20, bold: true, color: COLORS.white, fontFace: 'Calibri',
  })
  slide.addText(`${slideNum} / ${total}`, {
    x: 8.8, y: 0.1, w: 0.7, h: 0.5,
    fontSize: 11, color: 'A5B4FC', align: 'right', fontFace: 'Calibri',
  })
}

// ── Slide 1：封面 ─────────────────────────────────────────────
function addCoverSlide(prs, client, aiContent) {
  const slide = prs.addSlide()
  const today = new Date().toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric',
  })
  const sessionCount = 0  // passed from outside if needed

  const stageLabel = {
    preparation: '準備階段', stage1: '第一階段｜諮詢',
    stage2: '第二階段｜課程', stage3: '第三階段｜成果', completed: '已完成',
  }[client.current_stage] || client.current_stage

  // 深色上半部
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 3.2, fill: { color: COLORS.dark } })

  // 左側亮條
  slide.addShape('rect', { x: 0, y: 0, w: 0.22, h: 3.2, fill: { color: COLORS.accent } })

  // 課程標籤
  slide.addText('客製化教材', {
    x: 0.5, y: 0.3, w: 4, h: 0.35,
    fontSize: 12, color: 'A5B4FC', fontFace: 'Calibri', bold: true,
    charSpacing: 3,
  })

  // 學員姓名（大標）
  slide.addText(client.name, {
    x: 0.5, y: 0.7, w: 9, h: 1.1,
    fontSize: 54, bold: true, color: COLORS.white, fontFace: 'Calibri',
  })

  // 專案名稱
  slide.addText(client.project_name, {
    x: 0.5, y: 1.8, w: 9, h: 0.6,
    fontSize: 22, color: 'C4B5FD', fontFace: 'Calibri',
  })

  // 進度摘要（AI 生成）
  if (aiContent.progress_summary) {
    slide.addText(aiContent.progress_summary, {
      x: 0.5, y: 2.5, w: 9, h: 0.55,
      fontSize: 12, color: '94A3B8', fontFace: 'Calibri', italic: true,
    })
  }

  // 下半部資訊欄
  slide.addText(today, {
    x: 0.5, y: 3.4, w: 4, h: 0.4,
    fontSize: 14, color: COLORS.muted, fontFace: 'Calibri',
  })

  // 階段標籤
  slide.addShape('rect', {
    x: 0.5, y: 3.85, w: 2.2, h: 0.38,
    fill: { color: COLORS.accent }, rectRadius: 0.05,
  })
  slide.addText(stageLabel, {
    x: 0.5, y: 3.85, w: 2.2, h: 0.38,
    fontSize: 12, color: COLORS.white, fontFace: 'Calibri',
    align: 'center', valign: 'middle', bold: true,
  })

  // 技術背景標籤
  if (client.skills) {
    slide.addText(`技術背景：${client.skills}`, {
      x: 0.5, y: 4.35, w: 9, h: 0.3,
      fontSize: 11, color: COLORS.muted, fontFace: 'Calibri',
    })
  }

  // 右下品牌
  slide.addText('QutekangberAI Studio', {
    x: 6.5, y: 4.75, w: 3, h: 0.3,
    fontSize: 10, color: COLORS.muted, align: 'right', fontFace: 'Calibri',
  })
}

// ── Slide 2：成果檢視 ─────────────────────────────────────────
function addReviewSlide(prs, client, sessions, tasks) {
  const slide = prs.addSlide()
  addHeader(slide, '成果檢視', 2, 5)

  const doneTasks = tasks.filter(t => t.completed)
  const pendingTasks = tasks.filter(t => !t.completed)
  const completionRate = tasks.length > 0
    ? Math.round((doneTasks.length / tasks.length) * 100)
    : 0

  // ── 左欄：課程進度 ──
  slide.addText('課程進度', {
    x: 0.4, y: 0.82, w: 4.5, h: 0.34,
    fontSize: 13, bold: true, color: COLORS.primary, fontFace: 'Calibri',
  })

  if (sessions.length === 0) {
    slide.addText('尚未開始課程', {
      x: 0.4, y: 1.22, w: 4.5, h: 0.4,
      fontSize: 12, color: COLORS.muted, italic: true, fontFace: 'Calibri',
    })
  } else {
    sessions.slice(-3).forEach((s, i) => {
      const cardH = 1.0
      const y = 1.22 + i * (cardH + 0.1)
      const isLast = i === sessions.slice(-3).length - 1

      slide.addShape('rect', {
        x: 0.4, y, w: 4.5, h: cardH,
        fill: { color: isLast ? COLORS.lightBlue : COLORS.light },
        line: { color: isLast ? COLORS.primary : COLORS.border, width: isLast ? 1.5 : 1 },
      })
      slide.addText(`第 ${s.session_number} 堂${isLast ? '（最近）' : ''}`, {
        x: 0.55, y: y + 0.06, w: 4.1, h: 0.28,
        fontSize: 10, bold: true, color: isLast ? COLORS.primary : COLORS.muted,
        fontFace: 'Calibri', wrap: true,
      })
      slide.addText(s.progress, {
        x: 0.55, y: y + 0.34, w: 4.1, h: 0.58,
        fontSize: 10, color: COLORS.text, fontFace: 'Calibri',
        wrap: true, autoFit: true,
      })
    })
  }

  // 分隔線
  slide.addShape('line', {
    x: 5.1, y: 0.82, w: 0, h: 4.2,
    line: { color: COLORS.border, width: 1 },
  })

  // ── 右欄：作業清單 ──
  slide.addText(`作業完成率  ${completionRate}%`, {
    x: 5.3, y: 0.82, w: 4.2, h: 0.34,
    fontSize: 13, bold: true, color: COLORS.primary, fontFace: 'Calibri',
  })

  slide.addShape('rect', { x: 5.3, y: 1.22, w: 4.2, h: 0.2, fill: { color: COLORS.border } })
  if (completionRate > 0) {
    slide.addShape('rect', {
      x: 5.3, y: 1.22, w: 4.2 * (completionRate / 100), h: 0.2,
      fill: { color: COLORS.done },
    })
  }

  let ty = 1.55
  doneTasks.slice(0, 4).forEach(task => {
    slide.addText([
      { text: '✓  ', options: { color: COLORS.done, bold: true, fontSize: 11 } },
      { text: task.description, options: { color: COLORS.muted, fontSize: 11 } },
    ], { x: 5.3, y: ty, w: 4.2, h: 0.38, fontFace: 'Calibri', wrap: true })
    ty += 0.4
  })

  if (doneTasks.length > 0 && pendingTasks.length > 0) {
    slide.addShape('line', { x: 5.3, y: ty, w: 4.2, h: 0, line: { color: COLORS.border, width: 1 } })
    ty += 0.15
  }

  pendingTasks.slice(0, 4).forEach(task => {
    slide.addText([
      { text: '○  ', options: { color: COLORS.pending, bold: true, fontSize: 11 } },
      { text: task.description, options: { color: COLORS.text, fontSize: 11 } },
    ], { x: 5.3, y: ty, w: 4.2, h: 0.38, fontFace: 'Calibri', wrap: true })
    ty += 0.4
  })

  if (tasks.length === 0) {
    slide.addText('尚無作業紀錄', {
      x: 5.3, y: 1.55, w: 4.2, h: 0.38,
      fontSize: 11, color: COLORS.muted, italic: true, fontFace: 'Calibri',
    })
  }
}

// ── Slide 3：確立下次課程目標 ─────────────────────────────────
function addGoalsSlide(prs, goals) {
  const slide = prs.addSlide()
  addHeader(slide, '確立下次課程目標', 3, 5)

  slide.addText('以下目標直接對應學員的專案進度，上課時與學員確認並調整', {
    x: 0.4, y: 0.82, w: 9.2, h: 0.3,
    fontSize: 11, color: COLORS.muted, italic: true, fontFace: 'Calibri', wrap: true,
  })

  const bgColors = [COLORS.lightBlue, COLORS.lightPurple, 'E0F2FE']
  const borderColors = [COLORS.primary, COLORS.accent, COLORS.cyan]

  // 每張卡片固定高度 1.2，三張加間距剛好放入 5.08 高的投影片
  const cardH = 1.18
  const gap = 0.1

  goals.slice(0, 3).forEach((goal, i) => {
    const y = 1.18 + i * (cardH + gap)

    slide.addShape('rect', {
      x: 0.4, y, w: 9.2, h: cardH,
      fill: { color: bgColors[i] },
      line: { color: borderColors[i], width: 1.5 },
    })

    // 數字條
    slide.addShape('rect', {
      x: 0.4, y, w: 0.52, h: cardH,
      fill: { color: borderColors[i] },
    })
    slide.addText(`${i + 1}`, {
      x: 0.4, y, w: 0.52, h: cardH,
      fontSize: 20, bold: true, color: COLORS.white,
      align: 'center', valign: 'middle', fontFace: 'Calibri',
    })

    // 標題
    slide.addText(goal.title || goal, {
      x: 1.06, y: y + 0.07, w: 8.0, h: 0.34,
      fontSize: 13, bold: true, color: borderColors[i],
      fontFace: 'Calibri', wrap: true,
    })

    // 詳細說明
    const detail = goal.detail || ''
    slide.addText(detail, {
      x: 1.06, y: y + 0.42, w: 8.0, h: 0.42,
      fontSize: 11, color: COLORS.text, fontFace: 'Calibri',
      wrap: true, autoFit: true,
    })

    // 對應專案目標
    const linked = goal.linked_project_goal || ''
    if (linked) {
      slide.addText(`↳ ${linked}`, {
        x: 1.06, y: y + 0.86, w: 8.0, h: 0.28,
        fontSize: 10, color: COLORS.muted, italic: true,
        fontFace: 'Calibri', wrap: true,
      })
    }
  })

  slide.addText('□ 三項目標確認完成      □ 部分修改      □ 全面調整，下次再議', {
    x: 0.4, y: 4.75, w: 9.2, h: 0.28,
    fontSize: 10, color: COLORS.muted, fontFace: 'Calibri',
  })
}

// ── Slide 4：教學內容 ─────────────────────────────────────────
function addTeachingSlide(prs, client, modules) {
  // 如果模組超過 2 個，分兩張投影片
  const slideModules = modules.slice(0, 3)

  slideModules.forEach((mod, modIdx) => {
    const slide = prs.addSlide()
    addHeader(slide, `教學內容 ${modIdx + 1}／${slideModules.length}`, 4, 5)

    // 模組標題列
    slide.addShape('rect', {
      x: 0.4, y: 0.78, w: 9.2, h: 0.48,
      fill: { color: COLORS.dark },
    })
    slide.addText(mod.title, {
      x: 0.55, y: 0.8, w: 6, h: 0.44,
      fontSize: 16, bold: true, color: COLORS.white, fontFace: 'Calibri',
      valign: 'middle',
    })
    slide.addText(`⏱ ${mod.duration || '20 分鐘'}`, {
      x: 7.2, y: 0.8, w: 2.2, h: 0.44,
      fontSize: 12, color: 'A5B4FC', fontFace: 'Calibri',
      align: 'right', valign: 'middle',
    })

    // 學習目標
    slide.addText('學習目標', {
      x: 0.4, y: 1.38, w: 2, h: 0.3,
      fontSize: 11, bold: true, color: COLORS.primary, fontFace: 'Calibri',
    })
    slide.addText(mod.objective || '', {
      x: 0.4, y: 1.7, w: 9.2, h: 0.44,
      fontSize: 12, color: COLORS.text, fontFace: 'Calibri',
      fill: { color: COLORS.lightBlue }, margin: [5, 10, 5, 10],
      wrap: true, autoFit: true,
    })

    // 操作步驟
    slide.addText('操作步驟', {
      x: 0.4, y: 2.24, w: 2, h: 0.3,
      fontSize: 11, bold: true, color: COLORS.primary, fontFace: 'Calibri',
    })
    const steps = mod.steps || []
    steps.slice(0, 4).forEach((step, i) => {
      const sy = 2.6 + i * 0.46
      slide.addShape('ellipse', {
        x: 0.4, y: sy + 0.05, w: 0.34, h: 0.34,
        fill: { color: COLORS.primary },
      })
      slide.addText(`${i + 1}`, {
        x: 0.4, y: sy + 0.05, w: 0.34, h: 0.34,
        fontSize: 11, bold: true, color: COLORS.white,
        align: 'center', valign: 'middle', fontFace: 'Calibri',
      })
      slide.addText(step, {
        x: 0.9, y: sy, w: 8.7, h: 0.44,
        fontSize: 11, color: COLORS.text, fontFace: 'Calibri',
        wrap: true, autoFit: true, valign: 'middle',
      })
    })

    const bottomY = 2.6 + Math.min(steps.length, 4) * 0.46 + 0.1

    // 核心概念
    if (mod.key_concept) {
      slide.addShape('rect', {
        x: 0.4, y: bottomY, w: 4.4, h: 0.58,
        fill: { color: COLORS.lightPurple },
        line: { color: COLORS.accent, width: 1.5 },
      })
      slide.addText([
        { text: '💡 核心概念  ', options: { bold: true, color: COLORS.accent, fontSize: 10 } },
        { text: mod.key_concept, options: { color: COLORS.text, fontSize: 10 } },
      ], { x: 0.55, y: bottomY + 0.06, w: 4.1, h: 0.46, fontFace: 'Calibri', wrap: true })
    }

    // 常見錯誤
    if (mod.common_mistake) {
      slide.addShape('rect', {
        x: 5.1, y: bottomY, w: 4.5, h: 0.58,
        fill: { color: COLORS.lightAmber },
        line: { color: COLORS.pending, width: 1.5 },
      })
      slide.addText([
        { text: '⚠ 常見卡關  ', options: { bold: true, color: COLORS.pending, fontSize: 10 } },
        { text: mod.common_mistake, options: { color: COLORS.text, fontSize: 10 } },
      ], { x: 5.25, y: bottomY + 0.06, w: 4.2, h: 0.46, fontFace: 'Calibri', wrap: true })
    }
  })
}

// ── Slide 5：下一步建議 ───────────────────────────────────────
function addNextStepsSlide(prs, client, nextSteps) {
  const slide = prs.addSlide()
  addHeader(slide, '下一步建議', 5, 5)

  slide.addText(`給 ${client.name} 的課後行動計劃`, {
    x: 0.4, y: 0.82, w: 9.2, h: 0.28,
    fontSize: 12, color: COLORS.muted, fontFace: 'Calibri', italic: true,
  })

  const icons = ['🎯', '🔧', '📌']
  const bgColors = [COLORS.lightBlue, COLORS.lightGreen, COLORS.lightPurple]
  const borderColors = [COLORS.primary, COLORS.done, COLORS.accent]

  nextSteps.slice(0, 3).forEach((step, i) => {
    const cardH = 1.08
    const y = 1.1 + i * (cardH + 0.1)

    slide.addShape('rect', {
      x: 0.4, y, w: 9.2, h: cardH,
      fill: { color: bgColors[i] },
      line: { color: borderColors[i], width: 1.5 },
    })

    // 圖示
    slide.addText(icons[i], {
      x: 0.52, y: y + 0.25, w: 0.55, h: 0.55,
      fontSize: 22, fontFace: 'Calibri',
    })

    // 行動項目
    slide.addText(step.action || step, {
      x: 1.2, y: y + 0.08, w: 6.3, h: 0.4,
      fontSize: 13, bold: true, color: COLORS.text,
      fontFace: 'Calibri', wrap: true,
    })

    // 目的
    if (step.purpose) {
      slide.addText(step.purpose, {
        x: 1.2, y: y + 0.5, w: 6.3, h: 0.46,
        fontSize: 11, color: COLORS.muted, fontFace: 'Calibri',
        wrap: true, autoFit: true,
      })
    }

    // 時間框
    if (step.timeframe) {
      slide.addShape('rect', {
        x: 7.75, y: y + 0.36, w: 1.65, h: 0.32,
        fill: { color: borderColors[i] },
      })
      slide.addText(step.timeframe, {
        x: 7.75, y: y + 0.36, w: 1.65, h: 0.32,
        fontSize: 10, color: COLORS.white,
        align: 'center', valign: 'middle', fontFace: 'Calibri', wrap: true,
      })
    }
  })

  // 底部品牌列
  slide.addShape('rect', { x: 0, y: 4.72, w: '100%', h: 0.33, fill: { color: COLORS.dark } })
  slide.addText('QutekangberAI Studio', {
    x: 0, y: 4.72, w: '100%', h: 0.33,
    fontSize: 10, color: 'A5B4FC', align: 'center', valign: 'middle', fontFace: 'Calibri',
  })
}

// ── n8n 節點說明資料 ─────────────────────────────────────────
const N8N_NODES = [
  {
    name: 'HTTP Request',
    icon: '🌐',
    color: '0369A1',
    lightColor: 'E0F2FE',
    purpose: '向外部 API 或服務發送請求，取得或傳送資料。是 n8n 中最常用的節點，幾乎所有第三方系統整合都靠它。',
    fields: [
      { name: 'Method', desc: 'GET（取得資料）/ POST（新增）/ PUT（更新）/ DELETE（刪除）' },
      { name: 'URL', desc: '目標 API 的完整網址，可使用 {{ }} 插入動態值' },
      { name: 'Authentication', desc: '驗證方式：None / Basic Auth / Header Auth / OAuth2' },
      { name: 'Body', desc: '送出的資料格式：JSON / Form-Data / Raw，依 API 規格設定' },
      { name: 'Headers', desc: '自訂標頭，例如 Content-Type: application/json' },
    ],
    steps: [
      '新增 HTTP Request 節點',
      '設定 Method（通常 POST 送資料 / GET 取資料）',
      '填入目標 URL（可從 API 文件複製）',
      '若需要驗證，在 Authentication 選擇類型並填入 API Key',
      '若是 POST，在 Body 選 JSON 並填入要送的欄位',
      '點 Test Step 確認回傳正確',
    ],
    example: '情境：自動把新訂單資料送到 Google Sheets\nURL: https://sheets.googleapis.com/v4/spreadsheets/{id}/values/A1:append\nMethod: POST | Body: { values: [[訂單編號, 品名, 金額]] }',
    tip: '遇到 401 錯誤通常是 API Key 填錯或過期；404 是 URL 路徑不對',
  },
  {
    name: 'Webhook',
    icon: '🔗',
    color: '7C3AED',
    lightColor: 'F5F3FF',
    purpose: '建立一個接收端，讓外部系統主動把資料推送進來觸發工作流。是自動化的起點，適合接表單、Line Bot、電商訂單通知等。',
    fields: [
      { name: 'HTTP Method', desc: 'GET / POST，大多數通知用 POST' },
      { name: 'Path', desc: '自訂路徑，例如 /order-notify，完整 URL 會顯示在節點上' },
      { name: 'Response Mode', desc: 'Immediately（立即回應）/ Last Node（工作流完成後回應）' },
      { name: 'Response Data', desc: '回傳給呼叫方的內容，可設定成功訊息或處理結果' },
    ],
    steps: [
      '新增 Webhook 節點，設為工作流第一個節點',
      '設定 HTTP Method 為 POST',
      '自訂 Path（如 /new-order）',
      '複製節點顯示的 Webhook URL',
      '把 URL 貼到外部系統的 Webhook 設定（如 Line、Shopify）',
      '點 Listen For Test Event，在外部系統觸發一次，確認收到資料',
    ],
    example: '情境：LINE 官方帳號收到訊息時觸發工作流\nWebhook URL 填入 LINE Developer Console\n收到的資料：{ type: "message", message: { text: "你好" }, userId: "U123..." }',
    tip: 'Production 環境記得關閉 Test URL，改用 Production URL，兩者不同',
  },
  {
    name: 'AI Agent',
    icon: '🤖',
    color: '059669',
    lightColor: 'ECFDF5',
    purpose: '連接 AI 模型（GPT / Claude / Gemini 等）進行智能處理，可搭配 Tools 讓 AI 自行決定要執行哪些動作，是建立智能自動化的核心。',
    fields: [
      { name: 'Model', desc: '選擇 AI 模型，需先在 Credentials 設定對應的 API Key' },
      { name: 'System Prompt', desc: '定義 AI 的角色與行為規則，決定輸出品質的最關鍵設定' },
      { name: 'User Message', desc: '每次傳給 AI 的輸入，通常用 {{ $json.message }} 帶入動態內容' },
      { name: 'Tools', desc: '可連接其他節點讓 AI 自行呼叫（如查資料庫、發 Email）' },
      { name: 'Memory', desc: '設定對話記憶，讓 AI 記住上下文（適合聊天機器人）' },
    ],
    steps: [
      '先到 Credentials 新增 AI 服務的 API Key（OpenAI / Anthropic 等）',
      '新增 AI Agent 節點，選擇對應的 Model',
      '撰寫 System Prompt（角色設定＋回答規則＋輸出格式要求）',
      '在 User Message 填入 {{ $json.userInput }} 取得上游資料',
      '若需要 AI 查詢外部資料，在 Tools 連接 HTTP Request 節點',
      '測試並根據輸出調整 System Prompt',
    ],
    example: '情境：自動分類客服訊息並回覆\nSystem Prompt: 你是客服助理，將訊息分類為「訂單問題/退款/其他」，若是訂單問題則回覆訂單查詢步驟\nUser Message: {{ $json.customerMessage }}',
    tip: 'System Prompt 越具體，輸出越穩定；加入「只回傳 JSON 格式」可讓後續節點更容易處理',
  },
  {
    name: 'Edit Fields（Set）',
    icon: '✏️',
    color: 'D97706',
    lightColor: 'FFFBEB',
    purpose: '新增、修改、刪除或重新命名資料欄位。當上游節點的欄位名稱或格式不符合下游需求時使用，是資料清洗的必備工具。',
    fields: [
      { name: 'Mode', desc: 'Manual（手動設定每個欄位）/ JSON（直接輸入 JSON 物件）' },
      { name: 'Fields to Set', desc: '設定要新增或修改的欄位名稱與值' },
      { name: 'Value Type', desc: 'String / Number / Boolean / Expression（可引用其他欄位）' },
      { name: 'Include Other Fields', desc: '是否保留原有欄位，預設關閉（只輸出設定的欄位）' },
    ],
    steps: [
      '新增 Edit Fields 節點',
      '點 Add Field，輸入新欄位名稱（如 customerName）',
      '在 Value 點閃電圖示切換為 Expression 模式',
      '輸入表達式取得上游值，例如：{{ $json.name.trim() }}',
      '如需保留原本所有欄位，開啟 Include Other Fields',
      '常用：日期格式化 {{ new Date($json.date).toLocaleDateString("zh-TW") }}',
    ],
    example: '情境：把訂單資料整理成統一格式\n原始資料：{ order_no: "A001", customer: "王小明", total: "1500" }\n處理後：{ 訂單編號: "A001", 客戶姓名: "王小明", 金額: 1500（轉數字）, 日期: "今日日期" }',
    tip: '開啟 Include Other Fields 才不會把原本的欄位都刪掉；數字欄位記得用 Number 型別，否則加總會變字串連接',
  },
  {
    name: 'Switch / IF / Filter',
    icon: '🔀',
    color: 'DC2626',
    lightColor: 'FEF2F2',
    purpose: '控制資料流向的三種節點：IF 做二選一判斷、Switch 做多條件分流、Filter 過濾不符合條件的資料。',
    fields: [
      { name: 'IF — Condition', desc: '設定一個條件（等於 / 包含 / 大於等），True 走上路、False 走下路' },
      { name: 'Switch — Rules', desc: '設定多個條件，每個條件對應一個輸出 Output（Output 0、1、2...）' },
      { name: 'Filter — Condition', desc: '符合條件的資料才能繼續往下，不符合直接丟棄' },
      { name: 'Value 1', desc: '要判斷的欄位，通常是 {{ $json.fieldName }}' },
      { name: 'Operation', desc: 'Equals / Contains / Greater Than / Regex 等比較方式' },
    ],
    steps: [
      '【IF】新增 IF 節點，設定條件：Value 1 填欄位，選 Operation，填 Value 2',
      '【IF】True 輸出接處理成功的節點，False 輸出接例外處理',
      '【Switch】新增 Switch，依序新增 Rules（每條 Rule 對應一個輸出）',
      '【Switch】最後一個輸出預設為 Fallback（以上條件都不符合）',
      '【Filter】新增 Filter，設定篩選條件，只有符合的資料會繼續流動',
      '點 Test Step 確認資料走到正確的輸出路徑',
    ],
    example: '情境：訂單金額分流處理\nSwitch 條件：\n• Output 0：金額 > 5000 → 走 VIP 處理流程\n• Output 1：金額 > 1000 → 走一般處理\n• Fallback → 走小額自動處理',
    tip: 'Switch 的條件由上往下判斷，先符合的先走；IF 適合非黑即白的判斷，多種情況用 Switch 更清楚',
  },
]

// ── n8n 節點說明投影片 ────────────────────────────────────────
function addN8nNodeSlides(prs, projectName) {
  // 章節封面
  const coverSlide = prs.addSlide()
  coverSlide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: COLORS.dark } })
  coverSlide.addShape('rect', { x: 0, y: 0, w: 0.25, h: '100%', fill: { color: '0369A1' } })
  coverSlide.addText('n8n 節點參考手冊', {
    x: 0.55, y: 1.8, w: 9, h: 0.9,
    fontSize: 40, bold: true, color: COLORS.white, fontFace: 'Calibri',
  })
  coverSlide.addText(projectName, {
    x: 0.55, y: 2.75, w: 9, h: 0.5,
    fontSize: 18, color: 'A5B4FC', fontFace: 'Calibri', italic: true,
  })
  coverSlide.addText('HTTP Request  ·  Webhook  ·  AI Agent  ·  Edit Fields  ·  Switch / IF / Filter', {
    x: 0.55, y: 3.5, w: 9, h: 0.38,
    fontSize: 13, color: '64748B', fontFace: 'Calibri',
  })
  coverSlide.addText('QutekangberAI Studio', {
    x: 6.5, y: 4.75, w: 3, h: 0.3,
    fontSize: 10, color: '475569', align: 'right', fontFace: 'Calibri',
  })

  // 每個節點一頁
  N8N_NODES.forEach((node, idx) => {
    const slide = prs.addSlide()

    // 頂部標題列
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.78, fill: { color: node.color } })
    slide.addText(`${node.icon}  ${node.name}`, {
      x: 0.4, y: 0.1, w: 7, h: 0.58,
      fontSize: 22, bold: true, color: COLORS.white, fontFace: 'Calibri', valign: 'middle',
    })
    slide.addText(`節點 ${idx + 1} / ${N8N_NODES.length}`, {
      x: 8.5, y: 0.1, w: 1.1, h: 0.58,
      fontSize: 10, color: 'FFFFFF', align: 'right', fontFace: 'Calibri', valign: 'middle',
    })

    // 用途說明
    slide.addShape('rect', {
      x: 0.4, y: 0.88, w: 9.2, h: 0.5,
      fill: { color: node.lightColor },
      line: { color: node.color, width: 1.5 },
    })
    slide.addText(node.purpose, {
      x: 0.55, y: 0.88, w: 9.0, h: 0.5,
      fontSize: 11, color: COLORS.text, fontFace: 'Calibri',
      valign: 'middle', wrap: true,
    })

    // ── 左欄：關鍵設定欄位 ──
    slide.addText('關鍵設定欄位', {
      x: 0.4, y: 1.5, w: 4.3, h: 0.3,
      fontSize: 12, bold: true, color: node.color, fontFace: 'Calibri',
    })
    node.fields.forEach((field, fi) => {
      const fy = 1.84 + fi * 0.46
      slide.addShape('rect', {
        x: 0.4, y: fy, w: 4.3, h: 0.42,
        fill: { color: fi % 2 === 0 ? COLORS.light : COLORS.white },
        line: { color: COLORS.border, width: 0.5 },
      })
      slide.addText(field.name, {
        x: 0.5, y: fy + 0.04, w: 1.1, h: 0.34,
        fontSize: 10, bold: true, color: node.color, fontFace: 'Calibri',
        wrap: true,
      })
      slide.addText(field.desc, {
        x: 1.65, y: fy + 0.04, w: 2.9, h: 0.34,
        fontSize: 10, color: COLORS.text, fontFace: 'Calibri',
        wrap: true, autoFit: true,
      })
    })

    // ── 右欄：設定步驟 ──
    slide.addText('設定步驟', {
      x: 5.0, y: 1.5, w: 4.6, h: 0.3,
      fontSize: 12, bold: true, color: node.color, fontFace: 'Calibri',
    })
    node.steps.forEach((step, si) => {
      const sy = 1.84 + si * 0.36
      slide.addShape('ellipse', {
        x: 5.0, y: sy + 0.04, w: 0.26, h: 0.26,
        fill: { color: node.color },
      })
      slide.addText(`${si + 1}`, {
        x: 5.0, y: sy + 0.04, w: 0.26, h: 0.26,
        fontSize: 8, bold: true, color: COLORS.white,
        align: 'center', valign: 'middle', fontFace: 'Calibri',
      })
      slide.addText(step, {
        x: 5.35, y: sy, w: 4.25, h: 0.34,
        fontSize: 9.5, color: COLORS.text, fontFace: 'Calibri',
        wrap: true, autoFit: true, valign: 'middle',
      })
    })

    // 底部：範例 + 提示
    slide.addShape('rect', {
      x: 0.4, y: 4.18, w: 5.6, h: 0.72,
      fill: { color: COLORS.light },
      line: { color: COLORS.border, width: 1 },
    })
    slide.addText([
      { text: '📌 範例  ', options: { bold: true, color: node.color, fontSize: 10 } },
      { text: node.example, options: { color: COLORS.text, fontSize: 9.5 } },
    ], {
      x: 0.55, y: 4.22, w: 5.3, h: 0.62,
      fontFace: 'Calibri', wrap: true, autoFit: true,
    })

    slide.addShape('rect', {
      x: 6.2, y: 4.18, w: 3.4, h: 0.72,
      fill: { color: 'FFFBEB' },
      line: { color: COLORS.pending, width: 1 },
    })
    slide.addText([
      { text: '💡 Tips  ', options: { bold: true, color: COLORS.pending, fontSize: 10 } },
      { text: node.tip, options: { color: COLORS.text, fontSize: 9.5 } },
    ], {
      x: 6.35, y: 4.22, w: 3.1, h: 0.62,
      fontFace: 'Calibri', wrap: true, autoFit: true,
    })
  })
}

// ── AI 影片生成提示詞教學 ─────────────────────────────────────
const AI_VIDEO_PROMPTS = [
  {
    category: '場景描述',
    color: '7C3AED',
    lightColor: 'F5F3FF',
    icon: '🎬',
    desc: '描述畫面的地點、時間、環境氛圍，是影片品質的基礎',
    structure: '地點 + 時間 + 天氣/光線 + 攝影機角度',
    examples: [
      'A modern office at golden hour, warm sunlight streaming through floor-to-ceiling windows, cinematic wide shot',
      'Rainy Tokyo street at night, neon reflections on wet pavement, close-up shot with shallow depth of field',
      '台北街頭傍晚，霓虹燈光倒映在水坑，電影感廣角鏡頭',
    ],
    tips: '加入光線描述（golden hour / soft studio lighting）效果提升最明顯',
  },
  {
    category: '角色與動作',
    color: '0369A1',
    lightColor: 'E0F2FE',
    icon: '🧍',
    desc: '描述影片中的人物外觀、表情、動作，讓畫面有生命感',
    structure: '人物特徵 + 服裝 + 動作 + 情緒',
    examples: [
      'A young woman in business casual, smiling confidently, walking toward camera in slow motion',
      'An elderly man with white beard, sitting by a window, reading a book, peaceful expression',
      '一位穿著傳統服飾的女性，在竹林中緩緩走動，若有所思',
    ],
    tips: '避免描述具體名人臉孔，改用「looks like a professional model」等通用描述',
  },
  {
    category: '風格與畫質',
    color: '059669',
    lightColor: 'ECFDF5',
    icon: '🎨',
    desc: '定義整體視覺風格，決定影片的質感和調性',
    structure: '畫質等級 + 風格流派 + 色調 + 特效',
    examples: [
      '8K ultra-realistic, cinematic color grading, film grain effect, anamorphic lens flare',
      'Anime style, vibrant colors, Studio Ghibli inspired, soft watercolor background',
      '復古膠卷風格，褪色色調，輕微顆粒感，1970 年代電影感',
    ],
    tips: '加入「cinematic」「photorealistic」「4K」可大幅提升畫面質感',
  },
  {
    category: '攝影機運動',
    color: 'D97706',
    lightColor: 'FFFBEB',
    icon: '🎥',
    desc: '控制鏡頭的移動方式，製造專業影片的動態感',
    structure: '鏡頭類型 + 移動方式 + 速度',
    examples: [
      'Slow dolly zoom in, dramatic reveal, smooth camera movement',
      'Aerial drone shot, rotating 360 degrees, sunrise time-lapse',
      '手持攝影機，輕微抖動，追拍奔跑場景，緊張感',
    ],
    tips: [
      'Dolly in：推近鏡頭',
      'Pan：水平掃視',
      'Tilt：垂直移動',
      'Tracking shot：跟拍',
      'Aerial shot：空拍',
    ].join('\n'),
  },
  {
    category: '負向提示詞',
    color: 'DC2626',
    lightColor: 'FEF2F2',
    icon: '🚫',
    desc: '告訴 AI 不要出現什麼，減少不想要的結果（Negative Prompt）',
    structure: '在 Negative Prompt 欄位填入要排除的元素',
    examples: [
      'blurry, low quality, distorted, watermark, text, logo',
      'extra fingers, deformed hands, ugly face, bad anatomy',
      'cartoon, anime, illustration（當你要寫實風格時）',
    ],
    tips: '常用萬用負向提示：「blurry, low quality, distorted faces, watermark, oversaturated」',
  },
]

function addAIVideoSlides(prs, projectName) {
  // 章節封面
  const coverSlide = prs.addSlide()
  coverSlide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '0F0F1A' } })
  coverSlide.addShape('rect', { x: 0, y: 0, w: 0.25, h: '100%', fill: { color: '7C3AED' } })
  coverSlide.addText('AI 影片生成提示詞教學', {
    x: 0.55, y: 1.6, w: 9, h: 0.9,
    fontSize: 38, bold: true, color: COLORS.white, fontFace: 'Calibri',
  })
  coverSlide.addText(projectName, {
    x: 0.55, y: 2.6, w: 9, h: 0.5,
    fontSize: 18, color: 'A5B4FC', fontFace: 'Calibri', italic: true,
  })
  coverSlide.addText('場景描述  ·  角色動作  ·  風格畫質  ·  攝影機運動  ·  負向提示詞', {
    x: 0.55, y: 3.3, w: 9, h: 0.38,
    fontSize: 13, color: '64748B', fontFace: 'Calibri',
  })
  coverSlide.addText('適用工具：Sora · Runway · Kling · Hailuo · Vidu', {
    x: 0.55, y: 3.85, w: 9, h: 0.35,
    fontSize: 12, color: '4C1D95', fontFace: 'Calibri',
  })

  AI_VIDEO_PROMPTS.forEach((section, idx) => {
    const slide = prs.addSlide()

    // 頂部色條
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.78, fill: { color: section.color } })
    slide.addText(`${section.icon}  提示詞技巧：${section.category}`, {
      x: 0.4, y: 0.1, w: 8, h: 0.58,
      fontSize: 21, bold: true, color: COLORS.white, fontFace: 'Calibri', valign: 'middle',
    })
    slide.addText(`${idx + 1} / ${AI_VIDEO_PROMPTS.length}`, {
      x: 8.8, y: 0.1, w: 0.8, h: 0.58,
      fontSize: 10, color: 'FFFFFF', align: 'right', fontFace: 'Calibri', valign: 'middle',
    })

    // 說明
    slide.addShape('rect', {
      x: 0.4, y: 0.88, w: 9.2, h: 0.44,
      fill: { color: section.lightColor },
      line: { color: section.color, width: 1.5 },
    })
    slide.addText(section.desc, {
      x: 0.55, y: 0.88, w: 9.0, h: 0.44,
      fontSize: 12, color: COLORS.text, fontFace: 'Calibri',
      valign: 'middle', wrap: true,
    })

    // 結構公式
    slide.addText('📐 結構公式', {
      x: 0.4, y: 1.44, w: 3, h: 0.3,
      fontSize: 11, bold: true, color: section.color, fontFace: 'Calibri',
    })
    slide.addShape('rect', {
      x: 0.4, y: 1.76, w: 9.2, h: 0.4,
      fill: { color: '1E1B4B' },
    })
    slide.addText(section.structure, {
      x: 0.55, y: 1.76, w: 9.0, h: 0.4,
      fontSize: 12, color: 'A5B4FC', fontFace: 'Courier New',
      valign: 'middle', wrap: true,
    })

    // 範例提示詞
    slide.addText('✍️ 範例提示詞', {
      x: 0.4, y: 2.28, w: 3, h: 0.3,
      fontSize: 11, bold: true, color: section.color, fontFace: 'Calibri',
    })
    section.examples.forEach((ex, ei) => {
      const ey = 2.6 + ei * 0.5
      slide.addShape('rect', {
        x: 0.4, y: ey, w: 9.2, h: 0.46,
        fill: { color: ei % 2 === 0 ? COLORS.light : COLORS.white },
        line: { color: COLORS.border, width: 0.5 },
      })
      slide.addText([
        { text: `${ei + 1}.  `, options: { bold: true, color: section.color, fontSize: 10 } },
        { text: ex, options: { color: COLORS.text, fontSize: 10 } },
      ], {
        x: 0.5, y: ey + 0.04, w: 9.0, h: 0.38,
        fontFace: 'Calibri', wrap: true, autoFit: true,
      })
    })

    // Tips
    const tipY = 2.6 + section.examples.length * 0.5 + 0.1
    slide.addShape('rect', {
      x: 0.4, y: tipY, w: 9.2, h: 0.6,
      fill: { color: 'FFFBEB' },
      line: { color: COLORS.pending, width: 1 },
    })
    slide.addText([
      { text: '💡  ', options: { bold: true, color: COLORS.pending, fontSize: 11 } },
      { text: typeof section.tips === 'string' ? section.tips : section.tips, options: { color: COLORS.text, fontSize: 10 } },
    ], {
      x: 0.55, y: tipY + 0.06, w: 9.0, h: 0.48,
      fontFace: 'Calibri', wrap: true, autoFit: true,
    })
  })
}

// ── 判斷是否為 n8n 專案 ───────────────────────────────────────
function isN8nProject(client) {
  const text = [client.project_name, ...(client.goals || [])].join(' ').toLowerCase()
  return text.includes('n8n')
}

// ── 判斷是否為 AI 影片生成專案 ───────────────────────────────
function isAIVideoProject(client) {
  const text = [client.project_name, ...(client.goals || [])].join(' ').toLowerCase()
  return ['影片', 'video', 'sora', 'runway', 'kling', 'vidu', 'hailuo', 'ai生成', '生成影片'].some(k => text.includes(k))
}

// ── 主函式 ────────────────────────────────────────────────────
export async function generateAndDownloadPPT({ client, sessions, tasks, consultation }) {
  const aiContent = await generateSlideContent({ client, sessions, tasks, consultation })

  const prs = new pptxgen()
  prs.layout = 'LAYOUT_16x9'

  addCoverSlide(prs, client, aiContent)
  addReviewSlide(prs, client, sessions, tasks)
  addGoalsSlide(prs, aiContent.goals || [])
  addTeachingSlide(prs, client, aiContent.teaching_modules || [])
  addNextStepsSlide(prs, client, aiContent.next_steps || [])

  if (isN8nProject(client)) {
    addN8nNodeSlides(prs, client.project_name)
  }

  if (isAIVideoProject(client)) {
    addAIVideoSlides(prs, client.project_name)
  }

  const today = new Date().toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\//g, '-')

  await prs.writeFile({ fileName: `${client.name}_教材_${today}.pptx` })
}
