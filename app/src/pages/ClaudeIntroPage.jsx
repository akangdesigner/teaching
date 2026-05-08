import Navbar from '@/components/Navbar'

const SECTIONS = [
  {
    id: 'what',
    label: '什麼是 Claude',
    content: `Claude 是由 Anthropic 開發的大型語言模型（LLM），與 ChatGPT、Gemini 並列為目前最主流的 AI 助理。

Anthropic 成立於 2021 年，核心團隊來自 OpenAI，專注於 AI 安全性研究。Claude 以長文本理解、複雜推理與自然對話為強項。`,
  },
  {
    id: 'models',
    label: '模型系列',
    content: null,
  },
  {
    id: 'strengths',
    label: '核心優勢',
    content: null,
  },
  {
    id: 'usecases',
    label: '實際應用',
    content: null,
  },
  {
    id: 'api',
    label: 'API 與整合',
    content: null,
  },
]

const MODELS = [
  { name: 'Claude Opus 4', tier: '最強', desc: '複雜推理、長文分析、高難度任務', speed: '慢', cost: '高' },
  { name: 'Claude Sonnet 4', tier: '平衡', desc: '日常工作、程式撰寫、文件生成', speed: '中', cost: '中' },
  { name: 'Claude Haiku 4', tier: '輕量', desc: '快速回應、分類、簡單問答', speed: '快', cost: '低' },
]

const STRENGTHS = [
  { icon: '◈', title: '超長上下文', body: '支援最高 200K tokens，可一次讀入整本書或大型程式庫，維持完整的上下文理解。' },
  { icon: '◉', title: '複雜推理', body: '在數學推導、邏輯分析與多步驟規劃任務上表現優異，適合需要深度思考的工作。' },
  { icon: '◎', title: '工具呼叫 (Tool Use)', body: '可呼叫外部 API、執行程式碼、搜尋網路，讓 AI 從「對話助理」升級為「自主執行代理」。' },
  { icon: '◇', title: '多模態理解', body: '支援圖片、PDF 等輸入，可分析截圖、解讀圖表、閱讀文件。' },
  { icon: '◆', title: '安全導向設計', body: 'Anthropic 以 Constitutional AI 訓練，Claude 在拒絕有害請求的同時仍保持高度實用性。' },
  { icon: '○', title: 'Prompt 快取', body: '對重複出現的長系統提示進行快取，大幅降低 API 成本與延遲。' },
]

const USE_CASES = [
  {
    category: '商務自動化',
    items: ['合約摘要與風險提示', 'Email 草稿生成', '會議紀錄整理', '客服 FAQ 自動回覆'],
  },
  {
    category: '程式開發',
    items: ['程式碼審查與重構', '單元測試生成', '技術文件撰寫', 'Debug 協助'],
  },
  {
    category: 'AI Agent',
    items: ['n8n 自動化流程設計', '多步驟資料處理', '網頁爬蟲 + 分析', '排程任務執行'],
  },
  {
    category: '內容創作',
    items: ['部落格文章撰寫', '社群貼文優化', '簡報腳本生成', 'SEO 關鍵字分析'],
  },
]

const API_STEPS = [
  { step: '01', title: '取得 API Key', desc: '至 console.anthropic.com 申請帳號，建立 API Key。' },
  { step: '02', title: '選擇模型', desc: '依任務複雜度選 Opus / Sonnet / Haiku，從 Sonnet 開始最划算。' },
  { step: '03', title: '呼叫 API', desc: '使用 Python/Node.js SDK 或直接以 HTTP POST 傳送訊息。' },
  { step: '04', title: '設計 Prompt', desc: '善用 System Prompt 設定角色，User Prompt 描述任務細節。' },
  { step: '05', title: '加入工具', desc: '定義 tools 結構讓 Claude 呼叫外部服務，實現 Agent 能力。' },
]

function SectionTag({ id, label, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`text-[10px] font-mono tracking-widest uppercase px-3 py-1.5 border transition-all duration-200 ${
        active
          ? 'border-primary text-primary bg-primary/10'
          : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )
}

export default function ClaudeIntroPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="max-w-3xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="mb-10">
          <p className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground mb-2">AI 工具介紹</p>
          <h1 className="font-display text-2xl font-medium tracking-tight mb-3">Claude 應用指南</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            從模型選擇到實際應用，了解如何將 Claude 整合進你的工作流程。
          </p>
        </div>

        {/* 什麼是 Claude */}
        <section className="mb-10">
          <h2 className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-4">什麼是 Claude</h2>
          <div className="border border-border p-5">
            <p className="text-sm text-foreground leading-relaxed mb-3">
              Claude 是由 <span className="text-primary font-mono">Anthropic</span> 開發的大型語言模型（LLM），
              與 ChatGPT、Gemini 並列為目前最主流的 AI 助理。
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Anthropic 成立於 2021 年，核心團隊來自 OpenAI，專注於 AI 安全性研究。
              Claude 以長文本理解、複雜推理與自然對話為強項，特別適合需要深度分析的商務與技術場景。
            </p>
          </div>
        </section>

        {/* 模型系列 */}
        <section className="mb-10">
          <h2 className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-4">模型系列</h2>
          <div className="space-y-0">
            {MODELS.map((m, i) => (
              <div
                key={m.name}
                className={`border border-border p-4 flex items-start gap-4 ${i > 0 ? '-mt-px' : ''}`}
              >
                <div className="flex-shrink-0 w-16">
                  <span className={`text-[10px] font-mono px-2 py-0.5 border ${
                    m.tier === '最強' ? 'border-primary/50 text-primary bg-primary/10' :
                    m.tier === '平衡' ? 'border-foreground/30 text-foreground bg-foreground/5' :
                    'border-border text-muted-foreground'
                  }`}>{m.tier}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-foreground mb-1">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
                <div className="flex-shrink-0 text-right space-y-0.5">
                  <p className="text-[10px] font-mono text-muted-foreground">速度 <span className="text-foreground">{m.speed}</span></p>
                  <p className="text-[10px] font-mono text-muted-foreground">費用 <span className="text-foreground">{m.cost}</span></p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 核心優勢 */}
        <section className="mb-10">
          <h2 className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-4">核心優勢</h2>
          <div className="grid grid-cols-2 gap-0">
            {STRENGTHS.map((s, i) => (
              <div
                key={s.title}
                className={`border border-border p-4 ${
                  i % 2 === 1 ? '-ml-px' : ''
                } ${i >= 2 ? '-mt-px' : ''}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-primary font-mono">{s.icon}</span>
                  <span className="text-xs font-mono tracking-wide text-foreground">{s.title}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 實際應用 */}
        <section className="mb-10">
          <h2 className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-4">實際應用場景</h2>
          <div className="grid grid-cols-2 gap-0">
            {USE_CASES.map((uc, i) => (
              <div
                key={uc.category}
                className={`border border-border p-4 ${i % 2 === 1 ? '-ml-px' : ''} ${i >= 2 ? '-mt-px' : ''}`}
              >
                <p className="text-[10px] font-mono tracking-widest uppercase text-primary mb-3">{uc.category}</p>
                <ul className="space-y-1.5">
                  {uc.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="text-border font-mono mt-0.5">–</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* API 與整合 */}
        <section className="mb-10">
          <h2 className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-4">API 整合入門</h2>
          <div className="space-y-0">
            {API_STEPS.map((s, i) => (
              <div key={s.step} className={`border border-border p-4 flex gap-5 ${i > 0 ? '-mt-px' : ''}`}>
                <span className="font-mono text-xs text-primary flex-shrink-0 w-6">{s.step}</span>
                <div>
                  <p className="text-xs font-mono text-foreground mb-1">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Code snippet */}
          <div className="mt-4 border border-border">
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">範例 — Python SDK</span>
            </div>
            <pre className="p-4 text-xs font-mono text-foreground/80 leading-relaxed overflow-x-auto bg-card">{`import anthropic

client = anthropic.Anthropic(api_key="YOUR_API_KEY")

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system="你是一位 n8n 自動化專家，幫助用戶設計工作流程。",
    messages=[
        {"role": "user", "content": "幫我設計一個自動寄送每週報告的 n8n 流程"}
    ]
)

print(message.content[0].text)`}</pre>
          </div>
        </section>

        {/* 與本課程的關係 */}
        <section className="mb-4">
          <h2 className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-4">與課程的關係</h2>
          <div className="border border-primary/30 bg-primary/5 p-5">
            <p className="text-xs font-mono text-primary uppercase tracking-widest mb-3">AI 應用 & n8n 自動化職涯家教</p>
            <div className="space-y-2.5">
              {[
                ['Claude API', '作為後端 AI 引擎，整合進 n8n workflow 或自建的 Web App'],
                ['Prompt Engineering', '學習如何設計有效的系統提示，提升 AI 輸出品質'],
                ['Tool Use / Function Calling', '讓 Claude 呼叫外部 API，實現真正的自動化 Agent'],
                ['成本控制', '善用 Haiku 處理簡單任務，Sonnet 處理主要工作，Opus 留給複雜分析'],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-3 text-xs">
                  <span className="font-mono text-primary flex-shrink-0">▸</span>
                  <span>
                    <span className="text-foreground font-mono">{title}</span>
                    <span className="text-muted-foreground"> — {desc}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
