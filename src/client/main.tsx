import 'virtual:uno.css'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import App from './App'
import ComponentsApp from './ComponentsApp'
import RoutesApp from './RoutesApp'
import { connectPanelApi } from '../ui/connect'

const api = await connectPanelApi()

// The hub registers Components / Routes as docks on this same build, differing only
// by hash, so one client bundle serves all three panels.
const [hash, setHash] = createSignal(location.hash)
const [root, setRoot] = createSignal('')
addEventListener('hashchange', () => setHash(location.hash))
void api
  .call('get-meta', {})
  .then((meta: { cwd: string }) => setRoot(meta.cwd))
  .catch(() => setRoot(''))

render(
  () => {
    if (hash() === '#/components') return <ComponentsApp api={api} root={() => root()} />
    if (hash() === '#/routes') return <RoutesApp api={api} root={() => root()} />
    return <App api={api} />
  },
  document.getElementById('root')!,
)
