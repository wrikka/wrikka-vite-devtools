# use-devfra

[Devframe](https://devfra.me) devtools hub พร้อม add-ons ครบชุด ในรูปแบบ **Vite plugin** — ใส่ `useDevfra()` ใน
`vite.config.ts` ได้ hub ที่ `/__devframes/` ทันที พร้อม aggregate MCP endpoint สำหรับ agent

## Stack

| Package | Role |
|---|---|
| `devframe@1.2.x` | definition + RPC + MCP adapter |
| `@devframes/vite` | `viteDevframeHub` — Vite framework kit |
| `@devframes/hub(-ui)` | hub + UI |
| `@devframes/plugin-{inspect,data-inspector,og,a11y,git,terminals,assets}` | add-ons ( mounts ผ่าน plugin นี้) |
| `@devframes/plugin-code-server` | optional peer — `'code-server'` key |
| `@devframes/service-{open,git,shiki}` | services ที่ plugins self-provide |
| `@devframes/agentic` | MCP peer |
| `zod@4` | Standard Schema สำหรับ RPC args/returns |

## Layout

```
src/devframe.ts   defineDevframe (id: use-devfra) + rpc register
src/rpc.ts        RPC: get-meta (static), scan-dir (query) — zod schemas, agent-described
src/vite.ts       useDevfra(options) → Plugin[] — รวม hub + add-ons ที่เลือก mount
src/index.ts      barrel: definition, useDevfra, types, RPC declarations
src/client/       SPA ตัวอย่าง — connectDevframe() + typed rpc
examples/playground/  Vite app ที่ mount plugin (auth: false)
```

## Usage (ใน Vite project ปลายทาง)

```ts
// vite.config.ts
import { useDevfra } from 'use-devfra/vite'

export default {
  plugins: [useDevfra()],        // default add-ons ทั้งหมดยกเว้น code-server
  // useDevfra({ plugins: 'all', base: '/__devframes/', mcp: 'auto', auth: false })
}
```

- เปิด `http://localhost:<port>/__devframes/` — hub UI (frames อยู่ที่ `<base><id>/`)
- MCP endpoint: `POST <base>__mcp` (ต้องมี `Origin` header ตาม vite origin check)
- plugin keys: `use-devfra | inspect | data-inspector | og | a11y | git | assets | terminals | code-server`
  - `data-inspector` ถูก re-key เป็น id `data-inspector` เพราะ id เดิม `devframes:plugin:data-inspector` มี colon ซึ่ง hub mount ไม่ได้ (DF8004)
  - `code-server` ต้อง `bun add @devframes/plugin-code-server` ก่อน

## Dev ( repo นี้)

```bash
bun install
bun run build        # tsdown (dist/*.mjs + dts) แล้ว vite build client (dist/client)
bun run playground   # build + vite examples/playground → http://localhost:5199/__devframes/
bun run typecheck
```

หมายเหตุ: playground import จาก `dist` (package self-reference) — แก้ `src/` แล้วต้อง `bun run build` ใหม่,
และ tsdown `clean: true` ลบ `dist/client` เสมอ จึง build ตามลำดับใน script `build` เท่านั้น

## RPC จาก client อื่น

```ts
import { connectDevframe } from 'devframe/client'

const us = (await connectDevframe()).scope('use-devfra')
const meta = await us.rpc.call('get-meta')
const scan = await us.rpc.call('scan-dir', { path: 'src', limit: 10 })
```

## Wire MCP เข้า agent client

ใช้ HTTP transport ที่ `http://localhost:<port>/__devframes/__mcp` (endpointเดียวกับที่ tools/list ของทุก frameรวมกันไว้)
