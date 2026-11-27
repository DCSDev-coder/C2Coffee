import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.PUBLIC_API_BASE_URL = 'https://example.test/v1';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_NAME = 'test';
process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-12345678901234567890';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-1234567890123456789';

const { enforceBaristaRouteAccess } = await import('../dist/admin/guard.js');
const barista = (method, url) => ({ method, url, adminAuth: { roles: ['barista'] } });

test('barista may request cancellation and review an existing request', () => {
  assert.doesNotThrow(() => enforceBaristaRouteAccess(barista('POST', '/v1/barista/orders/C2-123/cancellation-request')));
  assert.doesNotThrow(() => enforceBaristaRouteAccess(barista('PATCH', '/v1/admin/orders/C2-123/cancellation-request')));
});

test('barista cancellation permission does not allow other methods or routes', () => {
  for (const [method, url] of [
    ['GET', '/v1/barista/orders/C2-123/cancellation-request'],
    ['POST', '/v1/barista/orders/C2-123/cancellation-request/extra'],
    ['POST', '/v1/admin/orders/C2-123/cancellation-request'],
    ['POST', '/v1/barista/orders/C2-123/other']
  ]) {
    assert.throws(() => enforceBaristaRouteAccess(barista(method, url)), (error) => error.code === 'barista_route_forbidden');
  }
});

test('barista can view and respond to stock alerts without gaining broader access', () => {
  assert.doesNotThrow(() => enforceBaristaRouteAccess(barista('GET', '/v1/barista/inventory/alerts')));
  assert.doesNotThrow(() => enforceBaristaRouteAccess(barista('POST', '/v1/barista/inventory/alerts/42/respond')));
  for (const [method, url] of [
    ['DELETE', '/v1/barista/inventory/alerts/42/respond'],
    ['POST', '/v1/barista/inventory/alerts/42/other'],
    ['GET', '/v1/admin/inventory/alerts']
  ]) {
    assert.throws(() => enforceBaristaRouteAccess(barista(method, url)), (error) => error.code === 'barista_route_forbidden');
  }
});
