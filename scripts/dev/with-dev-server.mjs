// Run a command against an isolated `next dev` server, then shut it down.
//
//   node scripts/dev/with-dev-server.mjs --port 3101 --dist .next-schedule \
//     [--env SHOW_DEMO_CONTENT=true]... -- node scripts/dev/snap.mjs --out shots schedule
//
// The command receives BASE_URL=http://localhost:<port>. Each server uses its own distDir
// (NEXT_DIST_DIR) so several can run side by side. Exit code is the command's exit code.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
if (sep < 0) {
  console.error("Usage: with-dev-server.mjs --port N --dist DIR [--env K=V]... -- <command...>");
  process.exit(2);
}
const opts = argv.slice(0, sep);
const command = argv.slice(sep + 1);
let port = 3100;
let dist = ".next-dev-tool";
const extraEnv = {};
for (let i = 0; i < opts.length; i++) {
  if (opts[i] === "--port") port = Number(opts[++i]);
  else if (opts[i] === "--dist") dist = opts[++i];
  else if (opts[i] === "--env") {
    const [k, ...v] = opts[++i].split("=");
    extraEnv[k] = v.join("=");
  }
}

const baseUrl = `http://localhost:${port}`;
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const env = { ...process.env, NEXT_DIST_DIR: dist, PORT: String(port), ...extraEnv };

console.log(`[dev-server] starting next dev on ${baseUrl} (distDir ${dist})`);
const server = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
  cwd: root,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

function stop() {
  if (server.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
}
process.on("exit", stop);
process.on("SIGINT", () => process.exit(130));

async function waitForServer(timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (server.exitCode !== null) throw new Error(`next dev exited early:\n${serverLog}`);
    try {
      const res = await fetch(`${baseUrl}/`, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${baseUrl}\n${serverLog}`);
}

let code = 1;
try {
  await waitForServer();
  console.log(`[dev-server] ready`);
  const isNode = command[0] === "node";
  const child = spawnSync(isNode ? process.execPath : command[0], command.slice(1), {
    cwd: root,
    env: { ...env, BASE_URL: baseUrl },
    stdio: "inherit",
    shell: !isNode && process.platform === "win32",
  });
  code = child.status ?? 1;
} catch (error) {
  console.error(String(error));
} finally {
  const errors = serverLog
    .split("\n")
    .filter((l) => /error|⨯|warn/i.test(l))
    .slice(-40);
  if (errors.length) console.log(`[dev-server] server log (errors/warnings):\n${errors.join("\n")}`);
  stop();
}
process.exit(code);
