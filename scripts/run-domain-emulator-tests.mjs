import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";

const projectId = "demo-pageit-domain-emulator";
const host = "127.0.0.1";
const port = 8089;
const emulatorJar = join(
  homedir(),
  ".cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar",
);

const safeEnvironment = {
  ...process.env,
  CI: "1",
  GCLOUD_PROJECT: projectId,
  FIREBASE_CONFIG: JSON.stringify({ projectId }),
  FIRESTORE_EMULATOR_HOST: `${host}:${port}`,
};

for (const key of [
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_PROJECT",
]) {
  delete safeEnvironment[key];
}

function waitForPort(timeoutMs = 20_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = createConnection({ host, port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Firestore Emulator did not start on ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 100);
      });
    };
    attempt();
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: safeEnvironment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} exited with ${code ?? "no code"}${signal ? ` (${signal})` : ""}`,
        ),
      );
    });
  });
}

const emulator = spawn(
  "java",
  [
    "-jar",
    emulatorJar,
    "--host",
    host,
    "--port",
    String(port),
    "--webchannel_port",
    "9159",
    "--project_id",
    projectId,
    "--single_project_mode",
    "true",
    "--single_project_mode_error",
    "true",
  ],
  {
    cwd: process.cwd(),
    env: safeEnvironment,
    stdio: "inherit",
  },
);

let exitCode = 0;
try {
  await waitForPort();
  console.log(
    JSON.stringify({
      firestoreEmulatorHost: `${host}:${port}`,
      projectId,
      productionCredentialsRemoved: true,
    }),
  );
  await run("node", [
    "--require", "tsx/cjs",
    "--import", "tsx/esm",
    "--test",
    "--test-concurrency=1",
    "tests/admin-domain-update.firestore.test.mjs",
    "tests/admin-domain-status-sync.firestore.test.mjs",
  ]);
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  emulator.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      emulator.kill("SIGKILL");
      resolve();
    }, 5_000);
    emulator.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

process.exitCode = exitCode;
