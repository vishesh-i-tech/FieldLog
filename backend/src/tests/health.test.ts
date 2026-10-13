import { test } from 'node:test';
import * as assert from 'node:assert';
import { buildServer } from '../server.js';

test('GET /health returns JSON with health and uptime', async () => {
  const server = await buildServer();
  const response = await server.inject({
    method: 'GET',
    url: '/health',
  });

  assert.strictEqual(response.statusCode === 200 || response.statusCode === 503, true);
  const body = JSON.parse(response.payload);
  assert.ok(body.status);
  assert.ok(body.database);
  assert.ok(typeof body.uptimeSeconds === 'number');
  assert.ok(body.timestamp);
});

test('GET / returns API welcome metadata', async () => {
  const server = await buildServer();
  const response = await server.inject({
    method: 'GET',
    url: '/',
  });

  assert.strictEqual(response.statusCode, 200);
  const body = JSON.parse(response.payload);
  assert.strictEqual(body.app, 'FieldLog API');
  assert.strictEqual(body.healthUrl, '/health');
  assert.strictEqual(body.versionUrl, '/version');
});
