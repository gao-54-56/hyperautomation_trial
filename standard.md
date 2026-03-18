# IoT 客户端报文标准

本文档定义设备与服务端之间的 JSON 报文格式。若与其他文档冲突，以本文档为准。

## 1. 设备上报（send）

用途：设备周期性上报最新状态。

```json
{
  "id": "device-0",
  "client": "client-0",
  "seq": 0,
  "status": "ok",
  "payload": {
  }
}
```

字段说明：

- id: 设备唯一标识。类型为 string 或 number（建议 string）。
- client: 客户端实例标识，用于区分并发连接。
- seq: 当前客户端消息序号，建议单调递增。
- status: 设备状态，示例值为 ok。
- payload: 业务数据载荷。

## 2. 设备接收命令（recv）

用途：服务端向设备下发控制命令。

```json
{
  "type": "device-command",
  "id": "device-0",
  "command": "set-switch",
  "requestId": "req-456",
  "payload": {
  }
}
```

字段说明：

- type: 固定为 device-command。
- id: 目标设备标识。
- command: 命令类型。
- requestId: 请求追踪 ID，用于命令-回报关联。
- payload: 命令参数对象。

命令约定：

## 3. 命令执行回报（report）

用途：设备执行命令后，回报执行结果与最新状态。

```json
{
  "type": "device-state-report",
  "id": "device-0",
  "client": "client-0",
  "status": "ok",
  "source": "example-program",
  "requestId": "req-456",
  "payload": {
  }
}
```

字段说明：

- type: 固定为 device-state-report。
- id: 设备标识。
- client: 当前客户端实例标识。
- status: 执行状态，示例值为 ok。
- source: 消息来源，示例值为 example-program。
- requestId: 对应命令中的 requestId。
- payload: 执行后的设备状态。

## 4. 校验规则

- 所有消息必须是 JSON 对象。
- id 必填，且类型为 string 或 number。
- 命令消息必须包含 command。
- 上报与回报建议包含 payload 对象。
- 不允许使用无效 JSON（例如尾逗号、缺失逗号、重复键）。

## 5. 通信流程

1. 设备周期性发送 send 上报。
2. 服务端按需要下发 recv 命令。
3. 设备执行命令并发送 report 回报。
4. 服务端基于 requestId 关联一次命令闭环。