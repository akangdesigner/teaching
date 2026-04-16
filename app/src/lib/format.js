// Convert UTC ISO string to Taiwan time (UTC+8) for datetime-local input
export function toDatetimeInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const taipei = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return taipei.toISOString().slice(0, 16)
}

export function formatDate(iso, opts = {}) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: opts.noYear ? undefined : 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  })
}
