import { describe, it, expect } from 'vitest';
import { app } from '../src/index';

describe('API routes', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('GET /api/hello returns greeting', async () => {
    const res = await app.request('/api/hello');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });
});
