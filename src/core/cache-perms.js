// 磁盘缓存文件的权限收紧（剩余任务 F3）。
//
// `mkdir` / `writeFile` 的 mode 只作用于**新建**对象：旧版本以默认 umask 写下的
// `<id>.json` 会一直保持 0644，升级时只收紧目录是不够的——同机其他用户仍能读到
// cwd / 逐时用量。宿主在 initStore 读到缓存目录清单后，先按 0600 收紧一遍。
//
// 之所以做成「注入 fsp 的小函数」而不是内联在 host 里：Windows 的 chmod 只能切换
// 只读位，smoke 里对 mode 的断言在 Windows 上无法判别（会被跳过）。把调用本身
// 抽出来就能在**任何平台**用假 fsp 断言「确实按 0600 调用了每个 .json」，
// 而 POSIX 上真正的权限变化仍由 smoke 用 stat 端到端断言。
export async function tightenJsonFileModes(fsp, files, mode = 0o600) {
  let tightened = 0
  for (const file of Array.isArray(files) ? files : []) {
    if (typeof file !== 'string' || !file.endsWith('.json')) continue
    try {
      await fsp.chmod(file, mode)
      tightened += 1
    } catch (e) {
      // 文件已被孤儿清理删掉 / 被占用 / 非 POSIX：一律忽略。权限收紧失败绝不能
      // 变成「丢缓存」或「启动失败」的理由——缓存只是加速。
    }
  }
  return tightened
}
