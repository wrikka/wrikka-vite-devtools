/**
 * Bridge between the window contract (`main.tsx`) and the mounted App's chat
 * state. Calls made before the overlay boots are remembered and replayed on
 * registration, so an extension can fire `openChat` at any time.
 */
export interface ChatControl {
  open(): void
  close(): void
}

let control: ChatControl | undefined
let pendingOpen = false

export function registerChatControl(next: ChatControl | undefined): void {
  control = next
  if (control && pendingOpen) {
    pendingOpen = false
    control.open()
  }
}

/** `window.__WRIKKA_VITE_DEVTOOLS_OVERLAY__.openChat()` and `wrikka:open-chat`. */
export function openOverlayChat(): void {
  if (control) control.open()
  else pendingOpen = true
}

export function closeOverlayChat(): void {
  pendingOpen = false
  control?.close()
}
