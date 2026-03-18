# WS Server API Spec

本文档描述 [server/ws_server.py](server/ws_server.py) 的对外接口与消息语义，供 AI 与开发者统一参考。

## 1. 服务概览

- 默认端口：`8081`（环境变量 `WS_PORT`）
- WebSocket 入口：`GET /`
- HTTP API 前缀：`/api`
- CORS：允许任意来源，允许 `GET,POST,OPTIONS`
- 响应头包含：`Cache-Control: no-store`

## 2. 数据模型

### 2.1 设备 ID

- 字段名：`id`
- 类型：`string | number`（服务端内部会转成 `string`）
- 说明：所有设备相关消息与接口都依赖此字段。

### 2.2 merged map（内存状态）

- 存储结构：`merged_by_id[id] = payload_without_id`
- 写入规则：同一 `id` 后写覆盖前写
- 查询接口：`GET /api/merged-map` 或 `GET /api/merged-map/{id}`

## 3. HTTP API

## 3.1 OPTIONS /{tail:.*}

用于 CORS 预检。

- 响应：`204 {}`

## 3.2 GET /api/merged-map?id={id}
## 3.3 GET /api/merged-map/{id}

按设备 `id` 获取最新状态。

成功示例：

```json
{
  "id": "device-0",
  "payload": {
    "temperature": 27,
    "switchOn": false
  },
  "updatedAt": "2026-03-18T10:00:00+00:00"
}
```

错误：

- `400`：缺少或无效 `id`
- `404`：未找到该 `id` 的状态

## 3.4 GET /api/scripts

返回脚本控制器中的脚本列表（含运行状态）。

成功示例：

```json
{
  "scripts": [
    {
      "id": "demo-worker-alpha",
      "name": "Demo Worker Alpha",
      "running": false,
      "pid": null,
      "lastStartedAt": null,
      "lastExitedAt": null,
      "lastExitCode": null,
      "stopRequestedAt": null
    }
  ],
  "updatedAt": "2026-03-18T10:00:00+00:00"
}
```

## 3.5 POST /api/scripts/start

启动指定脚本。

请求体：

```json
{
  "id": "demo-worker-alpha"
}
```

成功示例：

```json
{
  "type": "script-started",
  "script": {
    "id": "demo-worker-alpha",
    "name": "Demo Worker Alpha",
    "running": true,
    "pid": 12345,
    "lastStartedAt": "2026-03-18T10:00:00+00:00",
    "lastExitedAt": null,
    "lastExitCode": null,
    "stopRequestedAt": null
  },
  "alreadyRunning": false,
  "updatedAt": "2026-03-18T10:00:00+00:00"
}
```

错误：

- `400`：JSON 无效或缺少 `id`
- `404`：脚本不存在

## 3.6 POST /api/scripts/stop

停止指定脚本。脚本不应自己退出，而是使用此调用退出！

请求体：

```json
{
  "id": "demo-worker-alpha"
}
```

成功示例：

```json
{
  "type": "script-stopped",
  "script": {
    "id": "demo-worker-alpha",
    "running": true,
    "stopRequestedAt": "2026-03-18T10:00:01+00:00"
  },
  "updatedAt": "2026-03-18T10:00:01+00:00"
}
```

错误：

- `400`：JSON 无效或缺少 `id`
- `404`：脚本不存在
- `409`：脚本当前未运行

## 3.7 POST /api/device/command

通过服务端向目标设备转发命令，并等待设备回报（最多 5 秒）。

请求体（最小）：

```json
{
  "id": "device-0",
  "command": "toggle"
}
```

请求体（完整示例）：

```json
{
  "id": "device-0",
  "command": "set-switch",
  "source": "frontend-widget",
  "client": "optional-client",
  "payload": {
    "switchOn": true
  },
  "switchOn": true
}
```

说明：

- 除保留字段外的额外字段会被并入 `payload`。
- 服务端会自动生成 `requestId` 并注入下发消息。

成功响应（来自设备回报聚合）：

```json
{
  "type": "device-command-result",
  "id": "device-0",
  "updated": {
    "type": "device-state-report",
    "client": "client-0",
    "status": "ok",
    "source": "example-program",
    "requestId": "1710000000000-ab12cd34",
    "payload": {
      "switchOn": true
    },
    "updatedAt": "2026-03-18T10:00:02+00:00"
  },
  "updatedAt": "2026-03-18T10:00:02+00:00",
  "requestId": "1710000000000-ab12cd34"
}
```

错误：

- `400`：JSON 无效、缺少 `id` 或 `command`
- `404`：目标设备未连接
- `409`：目标连接不可写
- `504`：设备超时未回报

## 3.8 POST /api/device/state

便捷状态接口。服务端会将请求映射为命令转发：

- `action == "toggle"` -> `command = "toggle"`
- 其他情况 -> `command = "set-switch"`

请求体示例：

```json
{
  "id": "device-0",
  "action": "toggle"
}
```

或：

```json
{
  "id": "device-0",
  "payload": {
    "switchOn": true
  }
}
```

响应与错误码同 `POST /api/device/command`。

## 3.9 POST /api/seed-sample

写入一条示例数据并广播 `state-updated`。

成功示例：

```json
{
  "type": "state-updated",
  "id": "demo-switch-1",
  "updated": {
    "payload": {
      "switchOn": false
    },
    "source": "server-seed",
    "updatedAt": "2026-03-18T10:00:00+00:00"
  },
  "updatedAt": "2026-03-18T10:00:00+00:00"
}
```

## 4. WebSocket 协议

连接地址：`ws://host:port/`

### 4.1 连接后服务端首条消息

```json
{
  "type": "connected",
  "message": "WebSocket server ready"
}
```

### 4.2 客户端上报（普通状态消息）

示例：

```json
{
  "id": "device-0",
  "client": "client-0",
  "seq": 12,
  "status": "ok",
  "payload": {
    "temperature": 27,
    "switchOn": false
  }
}
```

行为：

- 写入 merged map
- 向所有 WS 客户端广播：`state-updated`
- 向发送方回 ACK：`ack`

ACK 示例：

```json
{
  "type": "ack",
  "id": "device-0",
  "updated": {
    "client": "client-0",
    "seq": 12,
    "status": "ok",
    "payload": {
      "temperature": 27,
      "switchOn": false
    }
  }
}
```

### 4.3 服务端下发命令（由 /api/device/command 触发）

设备收到：

```json
{
  "type": "device-command",
  "id": "device-0",
  "command": "toggle",
  "source": "api-command",
  "requestId": "1710000000000-ab12cd34",
  "payload": {}
}
```

### 4.4 设备命令回报

设备发送：

```json
{
  "type": "device-state-report",
  "id": "device-0",
  "client": "client-0",
  "status": "ok",
  "source": "example-program",
  "requestId": "1710000000000-ab12cd34",
  "payload": {
    "switchOn": true
  }
}
```

行为：

- 写入 merged map
- 广播 `state-updated`
- 若 `requestId` 命中 pending command，则唤醒 HTTP 调用并返回结果

### 4.5 服务端广播事件

#### state-updated

```json
{
  "type": "state-updated",
  "id": "device-0",
  "updated": {
    "payload": {
      "switchOn": true
    },
    "updatedAt": "2026-03-18T10:00:02+00:00"
  },
  "updatedAt": "2026-03-18T10:00:02+00:00"
}
```

#### script-started

```json
{
  "type": "script-started",
  "script": { "id": "demo-worker-alpha", "running": true },
  "alreadyRunning": false,
  "updatedAt": "2026-03-18T10:00:00+00:00"
}
```

#### script-stopped

```json
{
  "type": "script-stopped",
  "script": { "id": "demo-worker-alpha", "running": true, "stopRequestedAt": "2026-03-18T10:00:01+00:00" },
  "updatedAt": "2026-03-18T10:00:01+00:00"
}
```

## 5. 错误处理

### 5.1 HTTP 错误格式

```json
{
  "message": "..."
}
```

### 5.2 WS 输入错误

当 JSON 非法或消息缺少 `id` 时，服务端向该连接回：

```json
{
  "type": "error",
  "message": "..."
}
```

## 6. AI 使用建议

- 需要获取设备最新状态时，优先使用 `GET /api/merged-map/{id}`。
- 需要控制设备并拿到执行结果时，使用 `POST /api/device/command`。
- 需要模拟简单切换时，使用 `POST /api/device/state` + `action: "toggle"`。
- 需要监控状态变化与脚本事件时，连接 WebSocket 并监听 `state-updated`、`script-started`、`script-stopped`。

## 7. 实现细节与易踩坑

### 7.1 保留字段与 payload 合并规则

`POST /api/device/command` 在转发前会处理字段：

- 保留字段：`type`、`id`、`requestId`、`command`、`client`、`source`、`payload`
- 其他字段：会被并入 `payload`

示例：

```json
{
  "id": "device-0",
  "command": "set-switch",
  "switchOn": true
}
```

服务端下发给设备时等价于：

```json
{
  "type": "device-command",
  "id": "device-0",
  "command": "set-switch",
  "requestId": "<server-generated>",
  "payload": {
    "switchOn": true
  }
}
```

### 7.2 device-state-report 不会返回 ack

当 WS 收到 `type = device-state-report` 时：

- 会广播 `state-updated`
- 会尝试唤醒 pending HTTP command
- 不会像普通上报那样返回 `ack`

客户端若依赖 ACK，请仅对普通状态上报消息期待 ACK。

### 7.3 `updatedAt` 的语义

- `GET /api/merged-map` 返回体中的 `updatedAt` 是查询时刻生成。
- `state-updated` 广播中的 `updatedAt` 来自事件产生时刻。
- 若设备上报中自带 `updatedAt`，会进入 merged map；查询接口最终字段仍会被接口层覆盖为查询时刻。

### 7.4 无健康检查接口

当前服务未实现 `/api/health`。联调探活建议用：

- `GET /api/scripts`
- 或 WebSocket 连接后等待首条 `connected` 消息

### 7.5 命令超时与重试建议

- 命令等待窗口固定为 5 秒。
- 超时返回 `504` 不代表设备离线，也可能是设备未回报 `device-state-report`。
- 上层调用建议：指数退避重试，并携带业务侧幂等键。


## 8. 联调速查清单

1. 设备 WS 上报必须包含 `id`（string 或 number）。
2. 控制接口 `/api/device/command` 必须包含 `id` 与 `command`。
3. 设备执行命令后应回 `device-state-report`，并带回同一个 `requestId`。
4. 若只看到 `state-updated` 但 HTTP 一直超时，优先检查 `requestId` 是否透传。
5. 若返回 `404 Target device is not connected`，先确认设备已连上 WS 并至少发送过一次含该 `id` 的消息。
