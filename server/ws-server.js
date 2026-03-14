import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

const PORT = Number(process.env.WS_PORT || 8081);

const mergedById = new Map();

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

  if (req.url === '/api/device-state' && req.method === 'POST') {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
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

        let nextPayload = payload;

        if (payload.action === 'toggle') {
          const current = getById(id);
          nextPayload = {
            id,
            switchOn: !Boolean(current.switchOn),
            source: payload.source || 'api-toggle',
            updatedAt: new Date().toISOString(),
          };
        }

        const updated = setById(nextPayload);
        const event = {
          type: 'state-updated',
          id,
          updated,
          currentSwitchOn: Boolean(updated.switchOn),
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
