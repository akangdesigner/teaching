const config = {
  trial:     { label: '試聽',   dotClass: 'stage-trial-dot',     textClass: 'stage-trial' },
  active:    { label: '進行中',  dotClass: 'stage-active-dot',    textClass: 'stage-active' },
  completed: { label: '已完成',  dotClass: 'stage-completed-dot', textClass: 'stage-completed' },
  // legacy fallbacks
  preparation: { label: '試聽',   dotClass: 'stage-trial-dot',  textClass: 'stage-trial' },
  stage1:      { label: '進行中', dotClass: 'stage-active-dot', textClass: 'stage-active' },
  stage2:      { label: '進行中', dotClass: 'stage-active-dot', textClass: 'stage-active' },
  stage3:      { label: '進行中', dotClass: 'stage-active-dot', textClass: 'stage-active' },
}

export default function StageTag({ stage }) {
  const { label, dotClass, textClass } = config[stage] ?? config.trial
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${textClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
      {label}
    </span>
  )
}
