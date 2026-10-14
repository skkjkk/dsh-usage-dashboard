// 会话日志文件名判定（纯函数：给定目录项列表，返回要读的那个文件）。
//
// 抽出来有两个原因（剩余任务 D2/E1）：宿主 walkStore 只能端到端测；而
// scripts/debug-total.js 曾硬编码 `session.jsonl.zstd`，在现行会话库
// （`session.v<N>.jsonl[.zstd]`）上直接失败。这里成为唯一的口径来源。

// 现行布局优先：带版本号的日志 > 无版本号的历史日志；同档位下文件名靠前者胜出
// （readdir 顺序不定，因此用「第一个匹配」而不是 last-wins，保证可复现）。
export function pickLogFile(files) {
  for (const f of files) if (/^session\.v\d+\.jsonl\.zstd$/.test(f)) return f
  for (const f of files) if (/^session\.v\d+\.jsonl$/.test(f)) return f
  if (files.includes('session.jsonl.zstd')) return 'session.jsonl.zstd'
  if (files.includes('session.jsonl')) return 'session.jsonl'
  return null
}
