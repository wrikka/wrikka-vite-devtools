# use-devfra

[Devframe](https://devfra.me) devtools hub พร้อม add-ons ครบชุด + in-page comment→agent workflow
ในรูปแบบ **Vite plugin** — ใส่ `useDevfra()` ใน `vite.config.ts` ได้ hub ที่ `/__devframes/` ทันที
พร้อม aggregate MCP endpoint สำหรับ agent

## Features

- **Comment overlay** — bar เล็กในหน้าเว็บ เลือกได้ 3 mode: `element` (ชี้ CSS path),
  `component` (resolve ชื่อ component ขึ้น framework), `page` (ทั้งหน้า/global)
- **Agent ทำงานทันที** — submit comment แล้ว plugin เรียก agent CLI (claude → codex → opencode)
  ให้เลย พร้อม stream log กลับเข้า Inbox และปุ่ม Re-run
- **รองรับ Solid / Vue / React / Nuxt / Svelte** — ตรวจจาก runtime marks ของ element
  (React fiber, `__vueParentComponent`, Svelte class hash, Solid `_$` marks, global markers)
- **Skill picker จาก harness** — เลือก skills (devin / claude / qoder global + project roots)
  แนบไปกับ comment เพื่อส่งต่อเป็น context ให้ agent
- **Page capture** — snap หน้าเป็น PNG (html-to-image) เก็บลง storage แล้วแนบ path ใน comment
- **Generate ideas** — ให้ AI propose เป็น modal cards (title + detail + impact) เลือก Apply
  แล้ว prefill เป็น comment ได้ทันที
- **Hub + add-ons + MCP** — inspect, og, a11y, git, assets, terminals (opt-in:
  data-inspector, code-server) และ MCP tool รวมทุก frame ที่ `POST <base>__mcp`

## Stack

| Package | Role |
|---|---|
| `devframe@1.2.x` | definition + RPC + MCP adapter |
| `@devframes/vite` | `viteDevframeHub` — Vite framework kit |
| `@devframes/hub(-ui)` | hub + UI |
| `@devframes/plugin-{inspect,data-inspector,og,a11y,git,terminals,assets}` | add-ons (mount ผ่าน plugin นี้) |
| `@devframes/plugin-code-server` | optional peer — `'code-server'` key |
| `@devframes/service-{open,git,shiki}` | services ที่ plugins self-provide |
| `@devframes/agentic` | MCP peer |
| `html-to-image` | page capture ใน overlay |
| `zod@4` | Standard Schema สำหรับ RPC args/returns |

## Layout

```text
src/devframe.ts        defineDevframe (id: use-devfra) + dock + RPC registration
src/vite.ts            useDevfra(options) → Plugin[] — hub + add-ons ที่เลือก mount
src/index.ts           barrel: definition, useDevfra, protocol types, meta RPC
src/protocol.ts        Selection / Comment / Idea schemas (zod) เป็น single source of truth
src/rpc/               comments · agents · skills · capture · ideas · meta
src/agent-runner.ts    drive claude / codex / opencode CLI, stream logs
src/comment-store.ts   comments.json under the hub project storage dir
src/overlay/          dock page-script (self-contained bundle): dom · picker ·
                       frameworks · composer · inbox · ideas-ui · main
src/client/           SPA ของ frame — connectDevframe() + typed rpc
examples/playground/  Vite app ที่ mount plugin (auth: false) — ที่สำหรับ verify agent e2e
```

## Usage (ใน Vite project ปลายทาง)

```ts
// vite.config.ts
import { useDevfra } from 'use-devfra/vite'

export default defineConfig({
  plugins: [
    useDevfra(),
    // หรือตั้งค่าเพิ่ม:
    // useDevfra({
    //   plugins: 'all',
    //   base: '/__devframes/',
    //   mcp: 'auto',
    //   auth: false,
    //   agent: { driver: 'auto', autoRun: true },
    //   skillsRoots: ['C:/Users/me/AppData/Roaming/devin/skills'],
    //   overlay: true,
    // }),
  ],
})
```

Options, MCP tool list, overlay flow และ RPC ทั้งหมดอยู่ใน [`USAGE.md`](USAGE.md)

- เปิด `http://localhost:<port>/__devframes/` — hub UI (frames อยู่ที่ `<base><id>/`)
- MCP endpoint: `POST <base>__mcp` (ต้องมี `Origin` header ตาม vite origin check)
- plugin keys: `use-devfra | inspect | data-inspector | og | a11y | git | assets | terminals | code-server`
  - `data-inspector` ถูก re-key เป็น id `data-inspector` เพราะ id เดิม `devframes:plugin:data-inspector`
    มี colon ซึ่ง hub mount ไม่ได้ (DF8004)
  - `code-server` ต้อง `bun add @devframes/plugin-code-server` ก่อน

## Dev (repo นี้)

```bash
bun install
bun run build        # build:pkg (tsdown) → build:overlay (dock bundle) → build:client (vite)
bun run playground   # build + vite examples/playground → http://localhost:5199/__devframes/
bun run typecheck
```

หมายเหตุ:

- playground import จาก `dist` (package self-reference) — แก้ `src/` แล้วต้อง `bun run build` ใหม่
- tsdown `clean: true` ลบ `dist/client` เสมอ จึง build ตามลำดับใน script `build` เท่านั้น
- overlay ต้อง bundle ให้ self-contained ที่สุด เพราะ hub serve เฉพาะ directory ของ `clientScript`
  แล้ว rewrite แค่ specifier ของ entry — sibling chunks ที่ `dist/overlay/` emit ออกมา resolve
  จาก path เดียวกัน (`<base><id>/__page-script/…`) และ module ต้อง export `default` เป็น function
