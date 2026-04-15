import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import Navbar from '../components/Navbar'
import StageTag from '../components/StageTag'

const FILTERS = [
  { key: 'all', label: '全部個案' },
  { key: 'preparation', label: '準備階段' },
  { key: 'stage1', label: '第一階段' },
  { key: 'stage2', label: '第二階段' },
  { key: 'stage3', label: '第三階段' },
  { key: 'completed', label: '已完成' },
]


export default function Dashboard() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setClients(data ?? [])
        setLoading(false)
      })
  }, [])

  const counts = clients.reduce((acc, c) => {
    acc[c.current_stage] = (acc[c.current_stage] ?? 0) + 1
    return acc
  }, {})

  const filtered = filter === 'all' ? clients : clients.filter(c => c.current_stage === filter)

  return (
    <div>
      <Navbar />
      <main className="max-w-5xl mx-auto px-8 py-10">

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-8 flex-wrap border-b border-border pb-5">
          {FILTERS.map(({ key, label }, i) => (
            <span key={key} className="flex items-center gap-1">
              {i > 0 && <span className="text-border mx-2 select-none">·</span>}
              <button
                onClick={() => setFilter(key)}
                className={`text-xs font-mono tracking-wide transition-colors duration-150 ${
                  filter === key
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
                <span className="ml-1.5 opacity-50">
                  {key === 'all' ? clients.length : (counts[key] ?? 0)}
                </span>
              </button>
            </span>
          ))}
        </div>

        {/* Client list */}
        {loading && (
          <p className="text-center text-muted-foreground font-mono text-sm py-20">載入中...</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground font-mono text-sm py-20">目前沒有個案</p>
        )}

        <div className="divide-y divide-border">
          {filtered.map((client, idx) => (
            <Link
              key={client.id}
              to={`/clients/${client.id}`}
              className="group flex items-center justify-between py-4 px-0 hover:px-3 border-l-2 border-transparent hover:border-primary transition-all duration-200"
            >
              <div className="flex items-center gap-5">
                {/* Index number */}
                <span className="font-mono text-xs text-muted-foreground w-6 flex-shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>

                {/* Avatar initial */}
                <div className="w-8 h-8 rounded-sm bg-primary/10 text-primary font-display font-medium flex items-center justify-center text-sm flex-shrink-0">
                  {client.name[0]}
                </div>

                {/* Name + project */}
                <div>
                  <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-150">
                    {client.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{client.project_name}</div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                {client.next_session_date && (
                  <div className="hidden md:flex flex-col items-end">
                    <span className="font-mono text-xs text-muted-foreground tracking-wider uppercase">下次</span>
                    <span className="font-mono text-xs text-foreground mt-0.5">
                      {formatDate(client.next_session_date)}
                    </span>
                  </div>
                )}
                <StageTag stage={client.current_stage} />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
