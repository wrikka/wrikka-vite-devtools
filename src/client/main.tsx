import 'virtual:uno.css'
import { createSignal, lazy, Match, Suspense, Switch } from 'solid-js'
import { render } from 'solid-js/web'
import App from './App'
import HomeApp from './HomeApp'
import Shell from './Shell'
import { connectPanelApi } from '../ui/connect'
import { Toaster } from '../ui/toast'
import { Skeleton } from './PanelKit'

// Panels are lazy chunks — the landing route (Home) and the default Comments
// panel stay eager, every audit panel loads on first visit.
const BundleApp = lazy(() => import('./BundleApp'))
const CanvasApp = lazy(() => import('./CanvasApp'))
const ComponentsApp = lazy(() => import('./ComponentsApp'))
const ConsoleApp = lazy(() => import('./ConsoleApp'))
const EnvApp = lazy(() => import('./EnvApp'))
const I18nApp = lazy(() => import('./I18nApp'))
const ImportsApp = lazy(() => import('./ImportsApp'))
const McpApp = lazy(() => import('./McpApp'))
const NetworkApp = lazy(() => import('./NetworkApp'))
const PerformanceApp = lazy(() => import('./PerformanceApp'))
const RoutesApp = lazy(() => import('./RoutesApp'))
const RunsApp = lazy(() => import('./RunsApp'))
const SecurityApp = lazy(() => import('./SecurityApp'))
const SolidApp = lazy(() => import('./SolidApp'))
const StateApp = lazy(() => import('./StateApp'))
const TestsApp = lazy(() => import('./TestsApp'))
const ThemeApp = lazy(() => import('./ThemeApp'))
const VisualDiffApp = lazy(() => import('./VisualDiffApp'))

const api = await connectPanelApi()

// The hub registers every panel as a dock on this same build, differing only by
// hash, so one client build serves them all.
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
      <Suspense fallback={<Skeleton lines={6} />}>
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
          <Match when={hash() === '#/canvas'}>
            <CanvasApp api={api} root={() => root()} />
          </Match>
        </Switch>
      </Suspense>
      <Toaster />
    </Shell>
  ),
  document.getElementById('root')!,
)
