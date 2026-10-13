import { spawn, spawnSync } from 'node:child_process'

export type AgentDriver = 'claude' | 'codex' | 'opencode'
export type DriverPreference = 'auto' | AgentDriver

const DRIVERS: AgentDriver[] = ['claude', 'codex', 'opencode']

function which(cmd: string): string | undefined {
  const finder = process.platform === 'win32' ? 'where.exe' : 'which'
  try {
    const res = spawnSync(finder, [cmd], { encoding: 'utf8', timeout: 5_000 })
    if (res.status !== 0) return undefined
    return res.stdout.split(/\r?\n/)[0]?.trim() || undefined
  } catch {
    return undefined
  }
}

export function detectDrivers(): AgentDriver[] {
  return DRIVERS.filter((d) => which(d))
}

export function pickDriver(preference: DriverPreference): AgentDriver | undefined {
  if (preference !== 'auto') return which(preference) ? preference : undefined
  return detectDrivers()[0]
}

/**
 * Every driver reads the prompt from stdin — avoids shell quoting entirely
 * (the overlay runs on Windows where these CLIs are .cmd shims).
 */
function driverArgs(driver: AgentDriver): string[] {
  switch (driver) {
    case 'claude':
      return ['-p', '--output-format', 'json']
    case 'codex':
      return ['exec', '--skip-git-repo-check']
    case 'opencode':
      return ['run']
  }
}

export interface RunOptions {
  cwd: string
  onChunk?: (text: string) => void
  signal?: AbortSignal
  timeoutMs?: number
}

export interface RunResult {
  ok: boolean
  output: string
  exitCode: number | null
  error?: string
}

function extractClaudeResult(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { result?: unknown }
    if (typeof parsed.result === 'string') return parsed.result
  } catch {
    /* fall through to raw output */
  }
  return raw
}

export function runOnce(driver: AgentDriver, prompt: string, opts: RunOptions): Promise<RunResult> {
  return new Promise((resolve) => {
    const bin = which(driver) ?? driver
    const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(bin)
    const child = spawn(bin, driverArgs(driver), {
      cwd: opts.cwd,
      shell: needsShell,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (result: RunResult) => {
      if (!settled) {
        settled = true
        opts.signal?.removeEventListener('abort', abort)
        resolve(result)
      }
    }
    const abort = () => child.kill()
    opts.signal?.addEventListener('abort', abort)
    const timer = opts.timeoutMs ? setTimeout(() => child.kill(), opts.timeoutMs) : undefined

    child.stdout?.on('data', (buf: Buffer) => {
      const text = buf.toString('utf8')
      stdout += text
      opts.onChunk?.(text)
    })
    child.stderr?.on('data', (buf: Buffer) => {
      stderr += buf.toString('utf8')
    })
    child.on('error', (err) => finish({ ok: false, output: stdout, exitCode: null, error: String(err) }))
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      const output = driver === 'claude' ? extractClaudeResult(stdout) : stdout
      finish({ ok: code === 0, output, exitCode: code, error: code === 0 ? undefined : stderr.slice(0, 2000) })
    })

    child.stdin?.write(prompt)
    child.stdin?.end()
  })
}

export function lastSummary(output: string): string {
  const match = [...output.matchAll(/SUMMARY:\s*(.+)/g)].pop()
  if (match?.[1]) return match[1].trim().slice(0, 500)
  const tail = output.trim().slice(-500)
  return tail || '(no output)'
}
