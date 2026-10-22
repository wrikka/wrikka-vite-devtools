import { connectDevframe } from 'devframe/client'
import type { PanelApi } from './api'

/** The scoped rpc surface is untyped until `typed-rpc.d.ts` augments it — this is the only place that casts it. */
type ScopedRpc = {
  call(id: string, args?: unknown): Promise<any>
  streaming: { subscribe<T>(channel: string, id: string): AsyncIterable<T> }
}

/** The devframe scope this package registers in (`devframe.ts`). */
const SCOPE = 'wrikka-vite-devtools'

/** Connect to this package's devframe scope and adapt it to the panel surface. */
export async function connectPanelApi(scope: string = SCOPE): Promise<PanelApi> {
  const rpc = (await connectDevframe()).scope(scope).rpc as unknown as ScopedRpc
  return {
    call: (id, args) => rpc.call(id, args),
    subscribe: (channel, id) => rpc.streaming.subscribe<string>(channel, id),
  }
}
