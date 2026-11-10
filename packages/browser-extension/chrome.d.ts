// Minimal ambient types for the Chrome extension APIs this package uses.
// (@types/chrome is not installed; keep this surface small and accurate.)

declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      id?: string
      tab?: { id?: number; url?: string; title?: string }
    }
    type MessageListener = (
      message: any,
      sender: MessageSender,
      sendResponse: (response?: any) => void,
    ) => boolean | void
    const onMessage: { addListener(cb: MessageListener): void }
    const onInstalled: { addListener(cb: () => void): void }
    function sendMessage(extensionId: string, message: any): Promise<any>
    function sendMessage(message: any): Promise<any>
    const lastError: { message?: string } | undefined
  }

  namespace tabs {
    interface Tab {
      id?: number
      url?: string
      title?: string
      active?: boolean
      windowId?: number
    }
    interface QueryInfo {
      active?: boolean
      currentWindow?: boolean
    }
    function query(queryInfo: QueryInfo): Promise<Tab[]>
    function sendMessage(tabId: number, message: any): Promise<any>
    function create(createProperties: { url: string; active?: boolean }): Promise<Tab | undefined>
  }

  namespace contextMenus {
    interface OnClickData {
      menuItemId: string | number
      linkUrl?: string
      pageUrl?: string
    }
    interface CreateProperties {
      id?: string
      title: string
      contexts?: string[]
    }
    function create(createProperties: CreateProperties): void
    function remove(id: string): void
    const onClicked: {
      addListener(cb: (info: OnClickData, tab?: tabs.Tab) => void): void
    }
  }
}

