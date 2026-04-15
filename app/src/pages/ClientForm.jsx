import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-xs tracking-widest uppercase text-muted-foreground">{children}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function FieldLabel({ children }) {
  return (
    <label className="block font-mono text-xs tracking-wider uppercase text-muted-foreground mb-1.5">
      {children}
    </label>
  )
}

export default function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [form, setForm] = useState({
    name: '', project_name: '', current_stage: 'preparation',
    personality: '', situation: '', skills: '', goals: '', next_session_date: '',
    consultation_date: '', summary: '', tech_level: 'beginner',
    weekly_hours: '', tools: '', project_proposals: '', consultation_notes: '',
    tasks: '',
  })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('consultations').select('*').eq('client_id', id).maybeSingle(),
      supabase.from('tasks').select('*').eq('client_id', id).order('created_at'),
    ]).then(([{ data: c }, { data: con }, { data: t }]) => {
      if (!c) return
      setForm({
        name: c.name ?? '', project_name: c.project_name ?? '',
        current_stage: c.current_stage ?? 'preparation',
        personality: c.personality ?? '', situation: c.situation ?? '',
        skills: c.skills ?? '', goals: (c.goals ?? []).join('\n'),
        next_session_date: c.next_session_date ? new Date(c.next_session_date).toISOString().slice(0, 16) : '',
        consultation_date: con?.date ? new Date(con.date).toISOString().slice(0, 16) : '',
        summary: con?.summary ?? '', tech_level: con?.tech_level ?? 'beginner',
        weekly_hours: con?.weekly_hours ?? '', tools: con?.tools ?? '',
        project_proposals: (con?.project_proposals ?? []).join('\n'),
        consultation_notes: con?.notes ?? '',
        tasks: (t ?? []).map(tk => tk.description).join('\n'),
      })
      setLoading(false)
    })
  }, [id, isEdit])

  function set(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  function setVal(field) {
    return (val) => setForm(prev => ({ ...prev, [field]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)

    const clientPayload = {
      name: form.name.trim(), project_name: form.project_name.trim(),
      current_stage: form.current_stage, personality: form.personality.trim(),
      situation: form.situation.trim(), skills: form.skills.trim(),
      goals: form.goals.split('\n').map(g => g.trim()).filter(Boolean),
      next_session_date: form.next_session_date || null,
    }

    let clientId = id
    if (isEdit) {
      await supabase.from('clients').update(clientPayload).eq('id', id)
    } else {
      const { data } = await supabase.from('clients').insert(clientPayload).select().single()
      clientId = data.id
    }

    const hasConsultation = form.summary || form.project_proposals || form.consultation_date
    if (hasConsultation) {
      const conPayload = {
        client_id: clientId, date: form.consultation_date || null,
        summary: form.summary.trim(), tech_level: form.tech_level,
        weekly_hours: form.weekly_hours.trim(), tools: form.tools.trim(),
        project_proposals: form.project_proposals.split('\n').map(p => p.trim()).filter(Boolean),
        notes: form.consultation_notes.trim(),
      }
      if (isEdit) {
        const { data: existing } = await supabase.from('consultations').select('id').eq('client_id', clientId).maybeSingle()
        if (existing) await supabase.from('consultations').update(conPayload).eq('id', existing.id)
        else await supabase.from('consultations').insert(conPayload)
      } else {
        await supabase.from('consultations').insert(conPayload)
      }
    }

    const taskList = form.tasks.split('\n').map(t => t.trim()).filter(Boolean)
    if (taskList.length > 0) {
      if (isEdit) await supabase.from('tasks').delete().eq('client_id', clientId).eq('source', 'stage1')
      await supabase.from('tasks').insert(
        taskList.map(desc => ({ client_id: clientId, description: desc, source: 'stage1' }))
      )
    }

    navigate(`/clients/${clientId}`)
  }

  if (loading) return (
    <div>
      <Navbar />
      <p className="text-center py-20 text-muted-foreground font-mono text-sm">載入中...</p>
    </div>
  )

  return (
    <div>
      <Navbar />
      <main className="max-w-2xl mx-auto px-8 py-10">

        <h1 className="font-display text-3xl font-medium text-foreground mb-8 tracking-tight">
          {isEdit ? '編輯個案' : '新增個案'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-10">

          {/* 基本資料 */}
          <section>
            <SectionTitle>基本資料</SectionTitle>
            <div className="space-y-5">
              <div>
                <FieldLabel>姓名 *</FieldLabel>
                <Input required value={form.name} onChange={set('name')} className="bg-card border-border focus:border-primary/50 rounded-none" />
              </div>
              <div>
                <FieldLabel>學習專案名稱</FieldLabel>
                <Input value={form.project_name} onChange={set('project_name')} className="bg-card border-border focus:border-primary/50 rounded-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>目前階段</FieldLabel>
                  <Select value={form.current_stage} onValueChange={setVal('current_stage')}>
                    <SelectTrigger className="bg-card border-border rounded-none font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border rounded-none font-mono text-xs">
                      <SelectItem value="preparation">準備階段</SelectItem>
                      <SelectItem value="stage1">第一階段｜諮詢</SelectItem>
                      <SelectItem value="stage2">第二階段｜課程</SelectItem>
                      <SelectItem value="stage3">第三階段｜成果</SelectItem>
                      <SelectItem value="completed">已完成</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>下次上課時間</FieldLabel>
                  <Input type="datetime-local" value={form.next_session_date} onChange={set('next_session_date')} className="bg-card border-border focus:border-primary/50 rounded-none font-mono text-xs" />
                </div>
              </div>
            </div>
          </section>

          {/* 個案背景 */}
          <section>
            <SectionTitle>個案背景</SectionTitle>
            <div className="space-y-5">
              <div>
                <FieldLabel>目前狀況</FieldLabel>
                <Input value={form.situation} onChange={set('situation')} placeholder="例：剛離職，目前在家顧小孩" className="bg-card border-border focus:border-primary/50 rounded-none" />
              </div>
              <div>
                <FieldLabel>技術背景 / 技能</FieldLabel>
                <Textarea rows={3} value={form.skills} onChange={set('skills')} className="bg-card border-border focus:border-primary/50 rounded-none resize-none" />
              </div>
              <div>
                <FieldLabel>性格特質</FieldLabel>
                <Input value={form.personality} onChange={set('personality')} placeholder="例：會主動尋找資源，偶爾需要督促" className="bg-card border-border focus:border-primary/50 rounded-none" />
              </div>
              <div>
                <FieldLabel>學習目標 <span className="text-muted-foreground/60 normal-case tracking-normal">（每行一個）</span></FieldLabel>
                <Textarea rows={4} value={form.goals} onChange={set('goals')} placeholder={"目標一\n目標二\n目標三"} className="bg-card border-border focus:border-primary/50 rounded-none resize-none" />
              </div>
            </div>
          </section>

          {/* 第一階段諮詢 */}
          <section>
            <SectionTitle>第一階段｜諮詢紀錄</SectionTitle>
            <div className="space-y-5">
              <div>
                <FieldLabel>諮詢日期</FieldLabel>
                <Input type="datetime-local" value={form.consultation_date} onChange={set('consultation_date')} className="bg-card border-border focus:border-primary/50 rounded-none font-mono text-xs" />
              </div>
              <div>
                <FieldLabel>諮詢摘要</FieldLabel>
                <Textarea rows={3} value={form.summary} onChange={set('summary')} placeholder="學員描述的問題與需求..." className="bg-card border-border focus:border-primary/50 rounded-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>技術程度</FieldLabel>
                  <Select value={form.tech_level} onValueChange={setVal('tech_level')}>
                    <SelectTrigger className="bg-card border-border rounded-none font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border rounded-none font-mono text-xs">
                      <SelectItem value="beginner">初學</SelectItem>
                      <SelectItem value="intermediate">有基礎</SelectItem>
                      <SelectItem value="advanced">進階</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>每週可投入時間</FieldLabel>
                  <Input value={form.weekly_hours} onChange={set('weekly_hours')} placeholder="例：3–6 小時" className="bg-card border-border focus:border-primary/50 rounded-none" />
                </div>
              </div>
              <div>
                <FieldLabel>主軸工具</FieldLabel>
                <Input value={form.tools} onChange={set('tools')} placeholder="例：n8n、Gemini" className="bg-card border-border focus:border-primary/50 rounded-none" />
              </div>
              <div>
                <FieldLabel>專案提案 <span className="text-muted-foreground/60 normal-case tracking-normal">（每行一個）</span></FieldLabel>
                <Textarea rows={3} value={form.project_proposals} onChange={set('project_proposals')} placeholder={"提案一\n提案二"} className="bg-card border-border focus:border-primary/50 rounded-none resize-none" />
              </div>
              <div>
                <FieldLabel>備註</FieldLabel>
                <Textarea rows={2} value={form.consultation_notes} onChange={set('consultation_notes')} className="bg-card border-border focus:border-primary/50 rounded-none resize-none" />
              </div>
            </div>
          </section>

          {/* 作業清單 */}
          <section>
            <SectionTitle>第一次作業清單</SectionTitle>
            <FieldLabel>作業項目 <span className="text-muted-foreground/60 normal-case tracking-normal">（每行一項）</span></FieldLabel>
            <Textarea
              rows={6}
              value={form.tasks}
              onChange={set('tasks')}
              placeholder={"n8n 環境建置\n教學影片：了解基礎概念\n搜尋 3–5 個工作流參考"}
              className="bg-card border-border focus:border-primary/50 rounded-none resize-none"
            />
          </section>

          {/* Actions */}
          <div className="flex gap-3 justify-end border-t border-border pt-6">
            <button
              type="button"
              onClick={() => navigate(isEdit ? `/clients/${id}` : '/')}
              className="font-mono text-xs tracking-wider border border-border text-muted-foreground px-6 py-2.5 hover:border-foreground hover:text-foreground transition-all duration-200"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="font-mono text-xs tracking-wider border border-primary/40 bg-primary/10 text-primary px-6 py-2.5 hover:bg-primary/20 transition-all duration-200 disabled:opacity-50"
            >
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>

        </form>
      </main>
    </div>
  )
}
