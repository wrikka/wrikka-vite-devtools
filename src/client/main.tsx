import 'virtual:uno.css'
import { render } from 'solid-js/web'
import { connectDevframe } from 'devframe/client'
import App from './App'
import type { PanelApi } from '../ui/api'

const scope = (await connectDevframe()).scope('wrikka-vite-devtools')
const rpc = scope.rpc as unknown as {
  call(id: string, args?: unknown): Promise<any>
  streaming: { subscribe<T>(channel: string, id: string): AsyncIterable<T> }
}
const api: PanelApi = {
  call: (id, args) => rpc.call(id, args),
  subscribe: (channel, id) => rpc.streaming.subscribe<string>(channel, id),
}

render(() => <App api={api} />, document.getElementById('root')!)
