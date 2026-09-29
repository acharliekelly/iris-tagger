import { describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';
import type { ImageProvider, ProjectConfig } from '../../../packages/core/src/types.js';
const id = 'b'.repeat(24);
const project: ProjectConfig = { schemaVersion: 1, id: 'x', name: 'X', groups: [], booleanTags: [{ id: 'face', label: 'Face' }] };
const provider: ImageProvider = { async listImages() { return []; }, async getPreview() { return new Uint8Array(); }, async updateTags() { return { tagIds: [], replacedTagIds: [], conflictedGroupIds: [] }; } };
describe('mutation origin security', () => {
  it('rejects cross-origin writes and missing origin', async () => {
    const app = createServer(project, provider);
    const cross = await app.inject({ method: 'PUT', url: `/api/images/${id}/tags`, headers: { host: '127.0.0.1:4000', origin: 'https://evil.example' }, payload: { add: ['face'] } });
    const missing = await app.inject({ method: 'PUT', url: `/api/images/${id}/tags`, headers: { host: '127.0.0.1:4000' }, payload: { add: ['face'] } });
    expect(cross.statusCode).toBe(403); expect(missing.statusCode).toBe(403);
    await app.close();
  });
  it('rejects non-loopback Host headers on every read route', async () => {
    const app = createServer(project, provider);
    const headers = { host: 'attacker.example' };
    expect((await app.inject({ url: '/api/project', headers })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/images', headers })).statusCode).toBe(403);
    expect((await app.inject({ url: `/api/images/${id}/preview`, headers })).statusCode).toBe(403);
    await app.close();
  });
  it('accepts the explicitly configured local Vite origin', async () => {
    const app = createServer(project, provider, { devUiOrigin: 'http://127.0.0.1:5173' });
    const response = await app.inject({ method: 'PUT', url: `/api/images/${id}/tags`, headers: { host: '127.0.0.1:4174', origin: 'http://127.0.0.1:5173' }, payload: { add: ['face'] } });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
});
