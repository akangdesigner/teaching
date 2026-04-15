const config = {
  preparation: { label: '準備階段', dotClass: 'stage-preparation-dot', textClass: 'stage-preparation' },
  stage1:      { label: '第一階段｜諮詢', dotClass: 'stage-1-dot', textClass: 'stage-1' },
  stage2:      { label: '第二階段｜課程', dotClass: 'stage-2-dot', textClass: 'stage-2' },
  stage3:      { label: '第三階段｜成果', dotClass: 'stage-3-dot', textClass: 'stage-3' },
  completed:   { label: '已完成', dotClass: 'stage-completed-dot', textClass: 'stage-completed' },
}

export default function StageTag({ stage }) {
  const { label, dotClass, textClass } = config[stage] ?? config.preparation
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${textClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
      {label}
    </span>
  )
}
