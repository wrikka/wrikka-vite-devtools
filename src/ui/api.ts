/** The scoped devframe RPC surface shared by the in-page overlay and the hub panel. */
export interface PanelApi {
  call(id: string, args?: unknown): Promise<any>
  subscribe(channel: string, id: string): AsyncIterable<string>
}
