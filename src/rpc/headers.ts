import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import { devServerOrigin } from './context'
import { assertLocalOrigin } from './seo'

const REQUEST_TIMEOUT_MS = 10_000
const MAX_HEADERS = 80

export type HeaderCheckStatus = 'ok' | 'warn' | 'missing' | 'info'

export interface HeaderCheck {
  name: string
  header: string
  value?: string
  status: HeaderCheckStatus
  weight: number
  detail: string
}

function localBase(): string {
  return devServerOrigin('/') ?? 'http://localhost:5173/'
}

function has(headers: Headers, name: string): string | undefined {
  return headers.get(name) ?? undefined
}

/** Weighted 0–100; `info` checks (not applicable on http) stay out of the denominator. */
function score(checks: HeaderCheck[]): number {
  const graded = checks.filter((c) => c.status !== 'info')
  const total = graded.reduce((sum, c) => sum + c.weight, 0)
  if (total === 0) return 0
  const earned = graded.reduce(
    (sum, c) => sum + (c.status === 'ok' ? c.weight : c.status === 'warn' ? c.weight * 0.5 : 0),
    0,
  )
  return Math.round((earned / total) * 100)
}

export function judgeHeaders(headers: Headers, protocol: string): HeaderCheck[] {
  const checks: HeaderCheck[] = []
  const add = (check: HeaderCheck): void => void checks.push(check)

  const csp = has(headers, 'content-security-policy')
  const insecureCsp = csp ? /unsafe-inline/i.test(csp) && /unsafe-eval/i.test(csp) : false
  add({
    name: 'Content-Security-Policy',
    header: 'content-security-policy',
    value: csp,
    weight: 3,
    status: !csp ? 'missing' : insecureCsp ? 'warn' : 'ok',
    detail: !csp
      ? 'No CSP: any injected script runs with full page privileges.'
      : insecureCsp
        ? "CSP allows both 'unsafe-inline' and 'unsafe-eval', which defeats most of its value."
        : 'CSP present and does not blanket-allow inline and eval scripts.',
  })

  const hsts = has(headers, 'strict-transport-security')
  add({
    name: 'Strict-Transport-Security',
    header: 'strict-transport-security',
    value: hsts,
    weight: 2,
    status: protocol !== 'https:' ? 'info' : !hsts ? 'missing' : /max-age=\d{6,}/i.test(hsts) ? 'ok' : 'warn',
    detail:
      protocol !== 'https:'
        ? 'Ignored over plain http; re-run this audit on a TLS origin.'
        : !hsts
          ? 'Missing HSTS: the first http request can be downgraded.'
          : /max-age=\d{6,}/i.test(hsts)
            ? 'HSTS with a max-age of at least ~11 days.'
            : 'HSTS max-age is shorter than 6 days.',
  })

  const nosniff = has(headers, 'x-content-type-options')
  add({
    name: 'X-Content-Type-Options',
    header: 'x-content-type-options',
    value: nosniff,
    weight: 2,
    status: nosniff?.toLowerCase() === 'nosniff' ? 'ok' : 'missing',
    detail: nosniff?.toLowerCase() === 'nosniff' ? 'MIME sniffing disabled.' : 'Browsers may sniff a different content type.',
  })

  const frameAncestors = csp && /frame-ancestors/i.test(csp)
  const xfo = has(headers, 'x-frame-options')
  add({
    name: 'Framing control',
    header: 'x-frame-options',
    value: xfo ?? (frameAncestors ? 'csp frame-ancestors' : undefined),
    weight: 1,
    status: frameAncestors || xfo ? 'ok' : 'missing',
    detail: frameAncestors
      ? 'CSP frame-ancestors restricts who may embed this page.'
      : xfo
        ? `X-Frame-Options: ${xfo}.`
        : 'Neither X-Frame-Options nor CSP frame-ancestors: the page can be framed anywhere.',
  })

  const referrer = has(headers, 'referrer-policy')
  add({
    name: 'Referrer-Policy',
    header: 'referrer-policy',
    value: referrer,
    weight: 1,
    status: !referrer ? 'missing' : /unsafe-url/i.test(referrer) ? 'warn' : 'ok',
    detail: !referrer
      ? 'Default policy can leak full URLs to third parties.'
      : /unsafe-url/i.test(referrer)
        ? 'unsafe-url sends the full URL including path and query.'
        : 'Referrer policy limits what leaks cross-origin.',
  })

  const permissions = has(headers, 'permissions-policy')
  add({
    name: 'Permissions-Policy',
    header: 'permissions-policy',
    value: permissions,
    weight: 1,
    status: permissions ? 'ok' : 'missing',
    detail: permissions ? 'Sensitive browser features are scoped.' : 'No permissions policy: camera, mic, and sensors are unrestricted.',
  })

  const coop = has(headers, 'cross-origin-opener-policy')
  add({
    name: 'Cross-Origin-Opener-Policy',
    header: 'cross-origin-opener-policy',
    value: coop,
    weight: 1,
    status: coop ? 'ok' : 'missing',
    detail: coop ? `COOP: ${coop}.` : 'No COOP: a cross-origin opener keeps a window reference.',
  })

  const coep = has(headers, 'cross-origin-embedder-policy')
  add({
    name: 'Cross-Origin-Embedder-Policy',
    header: 'cross-origin-embedder-policy',
    value: coep,
    weight: 1,
    status: coep ? 'ok' : 'missing',
    detail: coep ? `COEP: ${coep}.` : 'No COEP: cross-origin resources load without opt-in (no SharedArrayBuffer isolation).',
  })

  const corp = has(headers, 'cross-origin-resource-policy')
  add({
    name: 'Cross-Origin-Resource-Policy',
    header: 'cross-origin-resource-policy',
    value: corp,
    weight: 1,
    status: corp ? 'ok' : 'missing',
    detail: corp ? `CORP: ${corp}.` : 'No CORP: other origins may embed these responses.',
  })

  return checks
}

export function createHeadersRpc() {
  const auditHeaders = defineRpcFunction({
    name: 'audit-headers',
    type: 'query',
    jsonSerializable: true,
    args: [z.object({ url: z.string().optional() })],
    agent: {
      description:
        'Fetch a local dev URL (default: the app root) and grade its security response headers (CSP, HSTS, COOP/COEP, nosniff, referrer, permissions) with a 0–100 score',
    },
    returns: z.object({
      ok: z.boolean(),
      url: z.string(),
      status: z.number(),
      durationMs: z.number(),
      score: z.number(),
      error: z.string().optional(),
      checks: z.array(
        z.object({
          name: z.string(),
          header: z.string(),
          value: z.string().optional(),
          status: z.enum(['ok', 'warn', 'missing', 'info']),
          weight: z.number(),
          detail: z.string(),
        }),
      ),
      headers: z.array(z.object({ name: z.string(), value: z.string() })),
    }),
    handler: async ({ url }) => {
      const startedAt = Date.now()
      let target: URL
      try {
        target = assertLocalOrigin(url?.trim() || localBase())
      } catch (err) {
        return {
          ok: false,
          url: url ?? '',
          status: 0,
          durationMs: Date.now() - startedAt,
          score: 0,
          error: err instanceof Error ? err.message : String(err),
          checks: [],
          headers: [],
        }
      }
      try {
        const res = await fetch(target, {
          redirect: 'follow',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        const headers: { name: string; value: string }[] = []
        res.headers.forEach((value, name) => {
          if (headers.length < MAX_HEADERS) headers.push({ name, value })
        })
        headers.sort((a, b) => a.name.localeCompare(b.name))
        const checks = judgeHeaders(res.headers, target.protocol)
        return {
          ok: true,
          url: target.toString(),
          status: res.status,
          durationMs: Date.now() - startedAt,
          score: score(checks),
          checks,
          headers,
        }
      } catch (err) {
        return {
          ok: false,
          url: target.toString(),
          status: 0,
          durationMs: Date.now() - startedAt,
          score: 0,
          error: err instanceof Error ? err.message : String(err),
          checks: [],
          headers: [],
        }
      }
    },
  })

  return { auditHeaders }
}
