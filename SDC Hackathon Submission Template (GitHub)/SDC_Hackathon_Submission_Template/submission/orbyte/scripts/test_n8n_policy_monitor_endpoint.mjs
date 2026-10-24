import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const port = 46000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const automationSecret = 'test-only-secret-do-not-use-in-production-1234567890';

test('n8n policy monitor endpoint requires its dedicated shared secret and Supabase config', async () => {
  const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      ORBYTE_AUTOMATION_SECRET: automationSecret,
      SUPABASE_URL: '',
      SUPABASE_SECRET_KEY: '',
      SUPABASE_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const request = (headers = {}) => fetch(`${baseUrl}/api/automation/policy-monitor/run`, {
    method: 'POST',
    headers,
  });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server exited before ready. Output:\n${output}`);
      try {
        const response = await fetch(`${baseUrl}/healthz`);
        if (response.ok) { ready = true; break; }
      } catch { /* wait for server startup */ }
      await delay(250);
    }
    assert.equal(ready, true, `Server did not start. Output:\n${output}`);

    const missing = await request();
    assert.equal(missing.status, 401, 'Missing automation secret must be rejected');

    const wrong = await request({ 'x-orbyte-automation-secret': 'wrong-secret' });
    assert.equal(wrong.status, 401, 'Incorrect automation secret must be rejected');

    const validButUnconfigured = await request({ 'x-orbyte-automation-secret': automationSecret });
    assert.equal(validButUnconfigured.status, 503, 'Valid automation secret cannot run without Supabase config');
    const responseBody = await validButUnconfigured.json();
    assert.equal(responseBody.success, false);
    assert.match(responseBody.error, /Supabase is not configured/i);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(3000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
});
