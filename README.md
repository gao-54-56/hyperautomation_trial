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
- Updates data by `id` in in-memory `Map` (same `id` replaces previous value).
- Exposes latest map snapshot: `GET /api/merged-map`
- Accepts state update JSON: `POST /api/device-state`
- Broadcasts `state-updated` JSON to all WS clients

## Python Test Client

- Install dependency: `pip install websockets`
- Run example: `python server/test_ws_client.py --clients 4 --messages 5`
- Optional args:
	- `--url ws://localhost:8081`
	- `--interval 0.5`

This script is for local integration testing in CPython.
Production can use MicroPython with the same JSON message format (`id` + payload fields).

## Frontend Demo Component

- Dynamic widget name: `UpdatedMapWidget`
- It polls `http://localhost:8081/api/merged-map` every 2 seconds and shows latest updated data.
- It has a switch button; clicking sends `{ "id": "demo-switch-1", "action": "toggle" }` to `POST /api/device-state`.
- The server returns authoritative current switch state (`currentSwitchOn`), and the page updates UI based on the response.
- The server also broadcasts a `state-updated` event for clients to receive.
- If your server address is different, set `VITE_WS_SERVER_URL`, for example:
	- `VITE_WS_SERVER_URL=http://127.0.0.1:9001 npm run dev`
