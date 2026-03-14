import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scriptDefinitions = [
  {
    id: 'demo-worker-alpha',
    name: 'Demo Worker Alpha',
    filePath: path.join(__dirname, '..', 'src', 'scripts', 'demo_worker_alpha.js'),
  },
  {
    id: 'demo-worker-beta',
    name: 'Demo Worker Beta',
    filePath: path.join(__dirname, '..', 'src', 'scripts', 'demo_worker_beta.js'),
  },
];

const processMap = new Map();
const statusMap = new Map(
  scriptDefinitions.map((item) => [
    item.id,
    {
      id: item.id,
      name: item.name,
      running: false,
      pid: null,
      lastStartedAt: null,
      lastExitedAt: null,
      lastExitCode: null,
      stopRequestedAt: null,
    },
  ])
);

function getScriptById(id) {
  return scriptDefinitions.find((item) => item.id === id) || null;
}

function listScripts() {
  return scriptDefinitions.map((item) => ({ ...statusMap.get(item.id) }));
}

function startScriptById(id) {
  const script = getScriptById(id);
  if (!script) {
    return { ok: false, statusCode: 404, message: 'Script not found' };
  }

  const runningProcess = processMap.get(id);
  const currentStatus = statusMap.get(id);
  if (runningProcess && currentStatus?.running) {
    return {
      ok: true,
      alreadyRunning: true,
      script: { ...currentStatus },
    };
  }

  const child = spawn(process.execPath, [script.filePath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const startedAt = new Date().toISOString();
  const nextStatus = {
    ...currentStatus,
    running: true,
    pid: child.pid,
    lastStartedAt: startedAt,
    stopRequestedAt: null,
  };

  statusMap.set(id, nextStatus);
  processMap.set(id, child);

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${id}] ${chunk.toString()}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${id}] ${chunk.toString()}`);
  });

  child.on('exit', (code) => {
    const prevStatus = statusMap.get(id);
    statusMap.set(id, {
      ...prevStatus,
      running: false,
      pid: null,
      lastExitedAt: new Date().toISOString(),
      lastExitCode: code,
    });
    processMap.delete(id);
  });

  return {
    ok: true,
    alreadyRunning: false,
    script: { ...nextStatus },
  };
}

function stopScriptById(id) {
  const script = getScriptById(id);
  if (!script) {
    return { ok: false, statusCode: 404, message: 'Script not found' };
  }

  const child = processMap.get(id);
  const currentStatus = statusMap.get(id);

  if (!child || !currentStatus?.running) {
    return {
      ok: false,
      statusCode: 409,
      message: 'Script is not running',
    };
  }

  child.kill('SIGTERM');

  const nextStatus = {
    ...currentStatus,
    stopRequestedAt: new Date().toISOString(),
  };
  statusMap.set(id, nextStatus);

  return {
    ok: true,
    script: { ...nextStatus },
  };
}

export { listScripts, startScriptById, stopScriptById };
