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
