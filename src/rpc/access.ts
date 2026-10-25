import type { Role } from '../protocol'

/**
 * Capabilities a role holds. The devtools run on a developer's machine, so the
 * default is a full operator; a preview or shared session can be started
 * read-only with `WRIKKA_DEVTOOLS_ROLE=viewer`, and every mutating RPC checks here.
 */
export const CAPABILITIES: Record<Role, readonly string[]> = {
  operator: [
    'comment:write',
    'comment:delete',
    'run:start',
    'run:cancel',
    'capture:write',
    'test:run',
    'mcp:call',
  ],
  viewer: [],
}

let role: Role = 'operator'

export function setRole(next: Role | undefined): void {
  role = next === 'viewer' ? 'viewer' : 'operator'
}

export function currentRole(): Role {
  return role
}

export function capabilities(): string[] {
  return [...CAPABILITIES[role]]
}

export function can(capability: string): boolean {
  return CAPABILITIES[role].includes(capability)
}

/** Throws the message the panel shows; the RPC contract is unchanged. */
export function assertCan(capability: string): void {
  if (!can(capability)) {
    throw new Error(`read-only session (viewer role): ${capability} is disabled`)
  }
}

/** Parse the env override once, so a typo falls back to operator instead of locking the hub. */
export function roleFromEnv(value: string | undefined): Role | undefined {
  return value === 'viewer' || value === 'operator' ? value : undefined
}
