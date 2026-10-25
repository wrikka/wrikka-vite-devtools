import 'virtual:uno.css'
import { createSignal, Match, Switch } from 'solid-js'
import { render } from 'solid-js/web'
import App from './App'
import BundleApp from './BundleApp'
import ComponentsApp from './ComponentsApp'
import ConsoleApp from './ConsoleApp'
import EnvApp from './EnvApp'
import I18nApp from './I18nApp'
import ImportsApp from './ImportsApp'
import McpApp from './McpApp'
import NetworkApp from './NetworkApp'
import PerformanceApp from './PerformanceApp'
import RoutesApp from './RoutesApp'
import RunsApp from './RunsApp'
import SecurityApp from './SecurityApp'
import SolidApp from './SolidApp'
import StateApp from './StateApp'
import TestsApp from './TestsApp'
import ThemeApp from './ThemeApp'
import VisualDiffApp from './VisualDiffApp'
import HomeApp from './HomeApp'
import Shell from './Shell'
import { connectPanelApi } from '../ui/connect'
import { Toaster } from '../ui/toast'

const api = await connectPanelApi()

// The hub registers every panel as a dock on this same build, differing only by
// hash, so one client bundle serves them all.
const [hash, setHash] = createSignal(location.hash)
const [root, setRoot] = createSignal('')
addEventListener('hashchange', () => setHash(location.hash))
void api
  .call('get-meta', {})
  .then((meta: { cwd: string }) => setRoot(meta.cwd))
  .catch(() => setRoot(''))

// Switch re-evaluates on every hashchange; an if-chain inside render() runs once
// and would pin the first panel for the whole document lifetime.
render(
  () => (
    <Shell hash={() => hash()} api={api}>
      <Switch fallback={<App api={api} />}>
        <Match when={hash() === '#/home'}>
          <HomeApp api={api} />
        </Match>
        <Match when={hash() === '#/components'}>
        <ComponentsApp api={api} root={() => root()} />
      </Match>
      <Match when={hash() === '#/routes'}>
        <RoutesApp api={api} root={() => root()} />
      </Match>
      <Match when={hash() === '#/solid'}>
        <SolidApp />
      </Match>
      <Match when={hash() === '#/theme'}>
        <ThemeApp api={api} root={() => root()} />
      </Match>
      <Match when={hash() === '#/bundle'}>
        <BundleApp api={api} />
      </Match>
      <Match when={hash() === '#/env'}>
        <EnvApp api={api} root={() => root()} />
      </Match>
      <Match when={hash() === '#/imports'}>
        <ImportsApp api={api} root={() => root()} />
      </Match>
      <Match when={hash() === '#/i18n'}>
        <I18nApp api={api} root={() => root()} />
      </Match>
      <Match when={hash() === '#/tests'}>
        <TestsApp api={api} root={() => root()} />
      </Match>
      <Match when={hash() === '#/runs'}>
        <RunsApp api={api} />
      </Match>
      <Match when={hash() === '#/mcp-playground'}>
        <McpApp api={api} />
      </Match>
      <Match when={hash() === '#/security'}>
        <SecurityApp api={api} />
      </Match>
      <Match when={hash() === '#/visual-diff'}>
        <VisualDiffApp api={api} />
      </Match>
      <Match when={hash() === '#/network'}>
        <NetworkApp api={api} />
      </Match>
      <Match when={hash() === '#/performance'}>
        <PerformanceApp api={api} />
      </Match>
      <Match when={hash() === '#/console'}>
        <ConsoleApp api={api} />
      </Match>
      <Match when={hash() === '#/state'}>
        <StateApp api={api} />
      </Match>
      </Switch>
      <Toaster />
    </Shell>
  ),
  document.getElementById('root')!,
)
