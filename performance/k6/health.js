import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.TARGET_BASE_URL || 'https://api.c2coffeeandcandle.com/v1').replace(/\/$/, '');

export const options = {
  vus: Number(__ENV.K6_VUS || 2),
  duration: __ENV.K6_DURATION || '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/health`, {
    headers: { Accept: 'application/json' },
    tags: { endpoint: 'health' },
  });

  check(response, {
    'health returns 200': (res) => res.status === 200,
    'health reports ok': (res) => res.json('status') === 'ok',
    'health identifies c2coffee-api': (res) => res.json('service') === 'c2coffee-api',
  });

  sleep(1);
}
