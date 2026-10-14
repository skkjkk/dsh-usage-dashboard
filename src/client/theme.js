// 视图常量与文案：纯数据，可被任何模块导入（不再依赖 apply() 闭包）。

export const BJ_OFFSET = 8 * 3600000
// ===== Dashboard tooltips & icons =====
export const COST_TIP = '费用按 vibe-usage-model-pricing-extended.csv 定价表估算（CNY 直接定价）；DeepSeek 现行两型号（deepseek-flash、deepseek-v4-pro）按峰谷计费（工作日高峰 9:00-12:00、14:00-18:00，北京时间，周末及其余时段为空闲（高峰一半）），V4.1 Flash 新价自 2026-09-10 12:00 起、V4 Pro 自 2026-09-14 12:00 起路由到 Flash 计费；已下线的旧名（deepseek-v4-flash / -vision-exp）与第三方变体名同样按 Flash 计费；未匹配模型暂不计费。点击卡片切换 ¥/＄。'
export const DUR_TIP = '会话时长说明：活跃时长 = 模型生成区间（请求发出 → 回复完成）的累计时长，不含工具执行时间；旧版日志带输出分块时从首个分块起算（不含排队与首 Token 延迟）。并行会话的生成时间会分别累加，因此可能超过 24H。'
export const TOTAL_TIP = '会话时长说明：总时长 = 每个会话从首条消息到末条消息的时间跨度，先合并重叠区间（并行会话只计一次）再相加；包含中间思考、看代码等空闲时间，但不包含会话之间的间隔，不会超过所选时间范围。'
export const DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export const HEAT_SCALES = {
  tokens: ['transparent', 'var(--dd-htk-1,#e4e4e7)', 'var(--dd-htk-2,#d4d4d8)', 'var(--dd-htk-3,#b8b8bd)', 'var(--dd-htk-4,#9ca3af)', 'var(--dd-htk-5,#7e8794)', 'var(--dd-htk-6,#646b78)', 'var(--dd-htk-7,#52525b)'],
  cost: ['transparent', 'var(--dd-hc-1,#d1fae5)', 'var(--dd-hc-2,#a7f3d0)', 'var(--dd-hc-3,#6ee7b7)', 'var(--dd-hc-4,#34d399)', 'var(--dd-hc-5,#10b981)', 'var(--dd-hc-6,#059669)', 'var(--dd-hc-7,#047857)'],
  dur: ['transparent', 'var(--dd-hd-1,#dbeafe)', 'var(--dd-hd-2,#bfdbfe)', 'var(--dd-hd-3,#93c5fd)', 'var(--dd-hd-4,#60a5fa)', 'var(--dd-hd-5,#3b82f6)', 'var(--dd-hd-6,#2563eb)', 'var(--dd-hd-7,#1d4ed8)']
}
export const BREAK_PTS = [0, 15, 30, 45, 60, 75, 90, 100]
export const TREND_SEG_COLORS = {
  output: 'var(--dd-text2,#18181b)', input: 'var(--dd-muted2,#71717a)', cache: 'var(--dd-border2,#d4d4d8)',
  cost: 'var(--dd-green,#10b981)', durActive: 'var(--dd-blue,#3b82f6)', durTotal: 'rgba(59,130,246,0.25)'
}
export const MODES = [
  { key: 'token', label: 'Token' },
  { key: 'cost', label: '费用' },
  { key: 'dur', label: '时长' }
]
export const RANGES = [
  { key: 'today', label: '今天', title: '今日 00:00 至今' },
  { key: '24h', label: '24H', title: '最近 24 小时（滚动窗口，含昨天同时段）' },
  { key: '7d', label: '7D', title: '最近 7 天（滚动窗口）' },
  { key: '30d', label: '30D', title: '最近 30 天（滚动窗口）' },
  { key: '90d', label: '90D', title: '最近 90 天（滚动窗口）' },
  { key: 'custom', label: '自定义', title: '自定义起止日期' }
]
export const DIST_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#eab308', '#52525b']
export const DIST_NAMED_LIMIT = 6
// 活跃热力图 8 阶色阶：空白与 Token 量分开，后续档位按每日绝对 Token 量递增。
// 1M/10M/30M/60M/100M/200M/250M 能覆盖常见工作日到高峰日的实际使用区间。
export const CAL_LEVELS = [
  { min: 0, label: '无 Token', color: 'var(--dd-cal-0,#EAEDEF)' },
  { min: 1000000, label: '≥ 1M', color: 'var(--dd-cal-1,#DDF3E5)' },
  { min: 10000000, label: '≥ 10M', color: 'var(--dd-cal-2,#B8E6C8)' },
  { min: 30000000, label: '≥ 30M', color: 'var(--dd-cal-3,#86D2A5)' },
  { min: 60000000, label: '≥ 60M', color: 'var(--dd-cal-4,#55BA83)' },
  { min: 100000000, label: '≥ 100M', color: 'var(--dd-cal-5,#2D9F68)' },
  { min: 200000000, label: '≥ 200M', color: 'var(--dd-cal-6,#1D7D50)' },
  { min: 250000000, label: '≥ 250M', color: 'var(--dd-cal-7,#125E3B)' }
]
