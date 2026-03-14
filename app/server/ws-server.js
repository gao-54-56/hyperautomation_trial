import { WebSocketServer } from 'ws';

const PORT = Number(process.env.WS_PORT || 8081);

const mergedById = new Map();

const wss = new WebSocketServer({ port: PORT });

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeById(payload) {
  const { id, ...rest } = payload;
  const previous = mergedById.get(id) || {};
  const merged = { ...previous, ...rest };
  mergedById.set(id, merged);
  return merged;
}

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

      const merged = mergeById(payload);

      socket.send(
        JSON.stringify({
          type: 'ack',
          id,
          merged,
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

console.log(`WS server started on ws://localhost:${PORT}`);

process.on('SIGINT', () => {
  wss.close(() => {
    console.log('WS server stopped');
    process.exit(0);
  });
});
