import { createSignal } from 'solid-js'
import type { PanelApi } from './api'

type Role = 'operator' | 'viewer'

const [role, setRole] = createSignal<Role>('operator')
const [caps, setCaps] = createSignal<string[]>([])
let loading: Promise<void> | undefined

/**
 * The session's capability set from `get-meta`. Requests are server-enforced;
 * this only lets the UI disable an action before the user hits a refusal.
 */
export function useAccess(api: PanelApi) {
  loading ??= api
    .call('get-meta', {})
    .then((meta: { role?: Role; capabilities?: string[] }) => {
      setRole(meta.role === 'viewer' ? 'viewer' : 'operator')
      setCaps(meta.capabilities ?? [])
    })
    .catch(() => {
      /* keep the operator defaults; the RPC call itself is the gate */
    })
  return {
    role,
    readOnly: () => role() === 'viewer',
    /** Unknown until meta lands → allow, and let the server decide. */
    can: (capability: string) => (caps().length === 0 ? role() !== 'viewer' : caps().includes(capability)),
  }
}
