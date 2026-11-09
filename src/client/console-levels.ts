import type { Tone } from '../ui/bits'

export type Level = 'error' | 'warn' | 'log' | 'info' | 'debug'
export type Filter = 'all' | Level

export const FILTERS: Filter[] = ['all', 'error', 'warn', 'log', 'info', 'debug']

export const LEVEL_TONE: Record<Filter, Tone> = {
  all: 'accent',
  error: 'bad',
  warn: 'warn',
  log: 'info',
  info: 'accent',
  debug: 'ok',
}

/** Full class names so the UnoCSS scanner can see every level colour. */
export const LEVEL_BAR: Record<Level, string> = {
  error: 'bg-bad',
  warn: 'bg-warn',
  log: 'bg-info',
  info: 'bg-accent',
  debug: 'bg-ok',
}

export function asLevel(value: string): Level {
  return value === 'error' || value === 'warn' || value === 'info' || value === 'debug' ? value : 'log'
}
