import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { listScripts, startScriptById, stopScriptById } from './script-controller.js';

const PORT = Number(process.env.WS_PORT || 8081);

const mergedById = new Map();
const deviceSockets = new Map();
const socketDevices = new Map();
const pendingCommands = new Map();

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function setById(payload) {
  const { id, ...rest } = payload;
  mergedById.set(id, rest);
  return rest;
}

function getById(id) {
  return mergedById.get(id) || {};
}

function registerSocketForDevice(socket, id) {
  if (!deviceSockets.has(id)) {
    deviceSockets.set(id, new Set());
  }

  deviceSockets.get(id).add(socket);

  if (!socketDevices.has(socket)) {
    socketDevices.set(socket, new Set());
  }

  socketDevices.get(socket).add(id);
}

function unregisterSocket(socket) {
  const ids = socketDevices.get(socket);
  if (!ids) {
    return;
  }

  ids.forEach((id) => {
    const sockets = deviceSockets.get(id);
    if (!sockets) {
      return;
    }

    sockets.delete(socket);
    if (!sockets.size) {
      deviceSockets.delete(id);
    }
  });

  socketDevices.delete(socket);
}

function createRequestId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dispatchDeviceCommand(id, payload) {
  const sockets = deviceSockets.get(id);
  if (!sockets || !sockets.size) {
    return Promise.resolve({
      ok: false,
      statusCode: 404,
      message: 'Target device is not connected',
    });
  }

  const requestId = createRequestId();
  const message = JSON.stringify({
    type: 'device-command',
    id,
    requestId,
    ...payload,
  });

  const targetSocket = Array.from(sockets).find((socket) => socket.readyState === WebSocket.OPEN);
  if (!targetSocket) {
    return Promise.resolve({
      ok: false,
      statusCode: 409,
      message: 'Target device connection is not writable',
    });
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingCommands.delete(requestId);
      resolve({
        ok: false,
        statusCode: 504,
        message: 'Target device response timeout',
      });
    }, 5000);

    pendingCommands.set(requestId, {
      resolve,
      timeout,
    });

    targetSocket.send(message);
  });
}

function broadcast(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    writeJson(res, 204, {});
    return;
  }

  if (req.url === '/api/merged-map' && req.method === 'GET') {
    const entries = Array.from(mergedById.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));

    writeJson(res, 200, {
      size: mergedById.size,
      entries,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (req.url === '/api/scripts' && req.method === 'GET') {
    writeJson(res, 200, {
      scripts: listScripts(),
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (req.url === '/api/scripts/start' && req.method === 'POST') {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        const { id } = payload || {};

        if (typeof id !== 'string' || !id.trim()) {
          writeJson(res, 400, { message: 'Payload must include script id (string)' });
          return;
        }

        const result = startScriptById(id);
        if (!result.ok) {
          writeJson(res, result.statusCode || 400, { message: result.message || 'Start failed' });
          return;
        }

        const event = {
          type: 'script-started',
          script: result.script,
          alreadyRunning: Boolean(result.alreadyRunning),
          updatedAt: new Date().toISOString(),
        };

        broadcast(event);
        writeJson(res, 200, event);
      } catch {
        writeJson(res, 400, { message: 'Invalid JSON' });
      }
    });

    return;
  }

  if (req.url === '/api/scripts/stop' && req.method === 'POST') {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        const { id } = payload || {};

        if (typeof id !== 'string' || !id.trim()) {
          writeJson(res, 400, { message: 'Payload must include script id (string)' });
          return;
        }

        const result = stopScriptById(id);
        if (!result.ok) {
          writeJson(res, result.statusCode || 400, { message: result.message || 'Stop failed' });
          return;
        }

        const event = {
          type: 'script-stopped',
          script: result.script,
          updatedAt: new Date().toISOString(),
        };

        broadcast(event);
        writeJson(res, 200, event);
      } catch {
        writeJson(res, 400, { message: 'Invalid JSON' });
      }
    });

    return;
  }

  if (req.url === '/api/device-command' && req.method === 'POST') {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

        if (!isObject(payload)) {
          writeJson(res, 400, { message: 'Payload must be a JSON object' });
          return;
        }

        const { id, command } = payload;
        if (typeof id !== 'string' && typeof id !== 'number') {
          writeJson(res, 400, { message: 'Payload must include id (string | number)' });
          return;
        }

        if (typeof command !== 'string' || !command) {
          writeJson(res, 400, { message: 'Payload must include command (string)' });
          return;
        }

        const result = await dispatchDeviceCommand(id, {
          command,
          switchOn: payload.switchOn,
          source: payload.source || 'api-command',
        });

        if (!result.ok) {
          writeJson(res, result.statusCode || 400, { message: result.message || 'Command failed' });
          return;
        }

        writeJson(res, 200, result.payload);
      } catch {
        writeJson(res, 400, { message: 'Invalid JSON' });
      }
    });

    return;
  }

  if (req.url === '/api/device-state' && req.method === 'POST') {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

        if (!isObject(payload)) {
          writeJson(res, 400, { message: 'Payload must be a JSON object' });
          return;
        }

        const { id } = payload;
        if (typeof id !== 'string' && typeof id !== 'number') {
          writeJson(res, 400, { message: 'Payload must include id (string | number)' });
          return;
        }

        const result = await dispatchDeviceCommand(id, {
          command: payload.action === 'toggle' ? 'toggle' : 'set-switch',
          switchOn: payload.switchOn,
          source: payload.source || 'api-device-state',
        });

        if (!result.ok) {
          writeJson(res, result.statusCode || 400, { message: result.message || 'Command failed' });
          return;
        }

        writeJson(res, 200, result.payload);
      } catch {
        writeJson(res, 400, { message: 'Invalid JSON' });
      }
    });

    return;
  }

  if (req.url === '/api/seed-sample' && req.method === 'POST') {
    const sample = {
      id: 'demo-switch-1',
      switchOn: false,
      source: 'server-seed',
      updatedAt: new Date().toISOString(),
    };
    const updated = setById(sample);
    const event = {
      type: 'state-updated',
      id: sample.id,
      updated,
      updatedAt: sample.updatedAt,
    };
    broadcast(event);
    writeJson(res, 200, event);
    return;
  }

  writeJson(res, 404, { message: 'Not Found' });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
  socket.send(
    JSON.stringify({
      type: 'connected',
      message: 'WebSocket server ready',
    })
  );

  socket.on('message', (raw) => {
    try {
      const payload = JSON.parse(raw.toString());

      if (!isObject(payload)) {
        socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Payload must be a JSON object',
          })
        );
        return;
      }

      const { id } = payload;

      if (typeof id !== 'string' && typeof id !== 'number') {
        socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Payload must include id (string | number)',
          })
        );
        return;
      }

      registerSocketForDevice(socket, id);

      if (payload.type === 'device-state-report') {
        const updated = setById({
          id,
          client: payload.client,
          switchOn: Boolean(payload.switchOn),
          status: payload.status || 'ok',
          source: payload.source || 'example-program',
          updatedAt: payload.updatedAt || new Date().toISOString(),
        });
        const event = {
          type: 'state-updated',
          id,
          updated,
          currentSwitchOn: Boolean(updated.switchOn),
          updatedAt: payload.updatedAt || new Date().toISOString(),
        };

        broadcast(event);

        if (payload.requestId && pendingCommands.has(payload.requestId)) {
          const pending = pendingCommands.get(payload.requestId);
          clearTimeout(pending.timeout);
          pendingCommands.delete(payload.requestId);
          pending.resolve({
            ok: true,
            payload: {
              type: 'device-command-result',
              id,
              updated,
              currentSwitchOn: Boolean(updated.switchOn),
              updatedAt: event.updatedAt,
              requestId: payload.requestId,
            },
          });
        }
        return;
      }

      const updated = setById(payload);
      const event = {
        type: 'state-updated',
        id,
        updated,
        updatedAt: new Date().toISOString(),
      };

      broadcast(event);

      socket.send(
        JSON.stringify({
          type: 'ack',
          id,
          updated,
        })
      );
    } catch {
      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid JSON',
        })
      );
    }
  });

  socket.on('close', () => {
    unregisterSocket(socket);
  });
});

server.listen(PORT, () => {
  console.log(`WS server started on ws://localhost:${PORT}`);
  console.log(`Map API ready at http://localhost:${PORT}/api/merged-map`);
});

process.on('SIGINT', () => {
  wss.close(() => {
    server.close(() => {
      console.log('WS server stopped');
      process.exit(0);
    });
  });
});
