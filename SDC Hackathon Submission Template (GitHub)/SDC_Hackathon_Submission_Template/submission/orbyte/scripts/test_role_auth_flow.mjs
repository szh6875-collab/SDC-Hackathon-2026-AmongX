import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 44500 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;

async function run() {
  console.log(`Starting test server on port ${port}...`);
  const child = spawn(
    'npx',
    ['tsx', 'server.ts'],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let output = '';
  child.stdout.on('data', (d) => { output += d.toString(); });
  child.stderr.on('data', (d) => { output += d.toString(); });

  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/state`);
      if (res.status === 200 || res.status === 401) {
        serverReady = true;
        break;
      }
    } catch {
      await delay(500);
    }
  }

  assert.ok(serverReady, `Server failed to start in time. Output: ${output}`);
  console.log('Server is running. Testing Role Login & Password Verification...');

  // 1. Test invalid password
  const failRes = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'owner', password: 'wrongpassword' }),
  });
  assert.equal(failRes.status, 401, 'Invalid password should be rejected with 401');
  const failData = await failRes.json();
  console.log('✓ Invalid password correctly rejected:', failData.message);

  // 2. Test valid owner login
  const ownerRes = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'owner', password: 'owner123' }),
  });
  assert.equal(ownerRes.status, 200, 'Owner login should succeed with 200');
  const ownerData = await ownerRes.json();
  assert.equal(ownerData.role, 'owner');
  assert.ok(ownerData.token);
  console.log('✓ Owner login succeeded with token:', ownerData.token.slice(0, 10) + '...');

  // 3. Test valid staff (clerk) login
  const clerkRes = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'staff', password: 'clerk123' }),
  });
  assert.equal(clerkRes.status, 200, 'Staff login should succeed with 200');
  const clerkData = await clerkRes.json();
  assert.equal(clerkData.role, 'clerk');
  console.log('✓ Staff (clerk) login succeeded');

  // 4. Test valid tax advisor (expert) login
  const expertRes = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'tax advisor', password: 'expert123' }),
  });
  assert.equal(expertRes.status, 200, 'Tax advisor login should succeed with 200');
  const expertData = await expertRes.json();
  assert.equal(expertData.role, 'expert');
  console.log('✓ Tax Advisor (expert) login succeeded');

  // 5. Test advisor permissions for policy monitoring
  const monitorRes = await fetch(`${baseUrl}/api/policy/monitoring/status`, {
    headers: { Authorization: `Bearer ${expertData.token}` },
  });
  assert.equal(monitorRes.status, 200, 'Tax advisor can access policy monitoring status');
  const monitorData = await monitorRes.json();
  console.log('✓ Policy monitoring accessible for Tax Advisor, activeVersion:', monitorData.activePolicyVersion);

  // 6. Blueprint activation is intentionally retired because it did not change processing rules.
  const bpRes = await fetch(`${baseUrl}/api/blueprint/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerData.token}`,
    },
    body: JSON.stringify({ title: 'Smart Consolidator' }),
  });
  assert.equal(bpRes.status, 410, 'Retired Blueprint activation must not silently appear operational');
  const blueprintRetired = await bpRes.json();
  assert.match(blueprintRetired.message, /no longer available/i);
  console.log('✓ Ineffective Blueprint activation is retired');

  // Clean up
  try {
    child.kill('SIGKILL');
  } catch {}
  console.log('🎉 All role login, password validation, and advisory endpoint tests PASSED!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
