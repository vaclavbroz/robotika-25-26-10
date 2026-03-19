import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const portsConfigPath = path.join(scriptDir, "dev-ports.json");
const portsConfig = readPortsConfig(portsConfigPath);
const requestedAppPort = portsConfig.appPort;
const requestedWsPort = portsConfig.wsPort;
const appPort = await resolveAvailablePort(requestedAppPort, "app");
const wsPort = await resolveAvailablePort(
  appPort === requestedWsPort ? requestedWsPort + 1 : requestedWsPort,
  "websocket",
);
const externalIp = readExternalIp(path.resolve(scriptDir, "../../.ip"));
const studentHost = externalIp || "localhost";
const studentUrl = `http://${studentHost}:${appPort}/`;
const childLogFilters = [/^\s*➜\s+Local:/, /^\s*➜\s+Network:/, /^\s*➜\s+press h \+ enter/i, /^\[server\] client url /];

if (appPort !== requestedAppPort) {
  console.log(`[dev] app port ${requestedAppPort} is busy, using ${appPort}`);
}
if (wsPort !== requestedWsPort) {
  console.log(`[dev] websocket port ${requestedWsPort} is busy, using ${wsPort}`);
}

console.log(`[start] Open in browser: ${studentUrl}`);

const processes = [
  {
    name: "client",
    cmd: "npm",
    args: ["--prefix", "packages/client", "run", "dev", "--", "--host", "--port", String(appPort)],
    env: {
      VITE_WS_PORT: String(wsPort),
      VITE_APP_PORT: String(appPort),
    },
  },
  {
    name: "server",
    cmd: "npm",
    args: ["--prefix", "packages/server", "run", "dev"],
    env: {
      PORT: String(wsPort),
      CLIENT_PORT: String(appPort),
    },
  },
];

const children = processes.map(({ name, cmd, args, env }) => {
  const child = spawn(cmd, args, {
    stdio: ["inherit", "pipe", "pipe"],
    env: {
      ...process.env,
      ...env,
    },
  });

  child.stdout.on("data", createChildLogRelay(name, process.stdout));
  child.stderr.on("data", createChildLogRelay(name, process.stderr));

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(1);
    }
  });

  return child;
});

let stopping = false;
function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 150);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function readPortsConfig(configPath) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error(`[dev] failed to read ${configPath}: ${error.message}`);
    process.exit(1);
  }

  const appPort = toValidPort(parsed.appPort, "appPort");
  const wsPort = toValidPort(parsed.wsPort, "wsPort");
  return { appPort, wsPort };
}

function toValidPort(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    console.error(`[dev] invalid ${name} in scripts/dev-ports.json: ${value}`);
    process.exit(1);
  }
  return parsed;
}

function readExternalIp(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, "utf8");
    const value = raw.split(/\r?\n/)[0]?.trim();
    return value || null;
  } catch {
    return null;
  }
}

function createChildLogRelay(name, target) {
  let buffered = "";

  return (chunk) => {
    buffered += chunk.toString();
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";

    for (const line of lines) {
      if (shouldSkipChildLogLine(line)) {
        continue;
      }
      target.write(`[${name}] ${line}\n`);
    }
  };
}

function shouldSkipChildLogLine(line) {
  return childLogFilters.some((pattern) => pattern.test(line));
}

async function resolveAvailablePort(preferredPort, label) {
  const maxAttempts = 20;
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidatePort = preferredPort + offset;
    // Bind to test whether the dev port is available before spawning processes.
    if (await canListenOnPort(candidatePort)) {
      return candidatePort;
    }
  }

  console.error(`[dev] unable to find an open ${label} port starting at ${preferredPort}`);
  process.exit(1);
}

function canListenOnPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(true));
    });
  });
}
