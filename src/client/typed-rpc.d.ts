import type { RpcDefinitionsToFunctionsWithNamespace } from 'devframe/types'
import type { getMeta, scanDir } from '../rpc'

declare module 'devframe' {
  interface DevframeRpcClientFunctions
    extends RpcDefinitionsToFunctionsWithNamespace<'use-devfra', [typeof getMeta, typeof scanDir]> {}
}

export {}
