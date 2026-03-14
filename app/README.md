# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).

## WebSocket Server

- Install dependencies: `npm install`
- Start server: `npm run ws:server`
- Default address: `ws://localhost:8081`
- Custom port: `WS_PORT=9001 npm run ws:server`

Expected client message format:

```json
{
	"id": "device-1",
	"temperature": 25,
	"status": "ok"
}
```

Server behavior:

- Accepts JSON objects from multiple clients.
- Requires `id` (`string` or `number`).
- Merges data by `id` into in-memory `Map` (new fields overwrite same-key old fields).
