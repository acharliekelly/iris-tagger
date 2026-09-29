import { describe, expect, it } from 'vitest';
import type { ImageProvider, ImageWithTags, ProjectConfig, TagMutation, TagUpdateResult } from '../../../packages/core/src/types.js';
import { createServer } from '../src/server.js';
import { ImageNotFoundError, ImageReadOnlyError } from '../../../packages/core/src/errors.js';
const id = 'a'.repeat(24);
const project: ProjectConfig = { schemaVersion: 1, id: 'demo', name: 'Demo', groups: [{ id: 'place', label: 'Place', selection: 'one', tags: [{ id: 'boston', label: 'Boston' }, { id: 'maine', label: 'Maine' }] }], booleanTags: [] };
class Provider implements ImageProvider {
  fail = false; readOnly = false; images: ImageWithTags[] = [{ image: { id, fileName: 'private-name.jpg', mimeType: 'image/jpeg', writable: true }, tagIds: ['boston'], conflictedGroupIds: [] }];
  async listImages() { return this.images; }
  async getPreview(imageId: string) { if (imageId !== id) throw Error('missing'); return new Uint8Array([1, 2, 3]); }
  async updateTags(imageId: string, mutation: TagMutation): Promise<TagUpdateResult> { if (imageId !== id) throw new ImageNotFoundError(); if (this.readOnly) throw new ImageReadOnlyError(); if (this.fail) throw Error('disk full'); return { tagIds: mutation.restore ?? mutation.add ?? [], replacedTagIds: ['boston'], conflictedGroupIds: [] }; }
}
const headers = { host: '127.0.0.1:4321', origin: 'http://127.0.0.1:4321' };
describe('image API', () => {
  it('returns project rules and image list without local adapter config', async () => {
    const app = createServer(project, new Provider());
    const response = await app.inject('/api/project');
    expect(response.json()).toEqual(project);
    expect(response.body).not.toContain('imageRoot');
    await app.close();
  });
  it('serves a no-store preview and updates tags', async () => {
    const app = createServer(project, new Provider());
    const preview = await app.inject(`/api/images/${id}/preview`);
    expect(preview.headers['cache-control']).toBe('no-store');
    expect(preview.headers['content-type']).toContain('image/jpeg');
    const updated = await app.inject({ method: 'PUT', url: `/api/images/${id}/tags`, headers, payload: { add: ['maine'] } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().tagIds).toEqual(['maine']);
    await app.close();
  });
  it('accepts an exact-state restore for Undo, including existing conflicts', async () => {
    const app = createServer(project, new Provider());
    const response = await app.inject({ method: 'PUT', url: `/api/images/${id}/tags`, headers, payload: { restore: ['boston', 'maine'] } });
    expect(response.statusCode).toBe(200);
    expect(response.json().tagIds).toEqual(['boston', 'maine']);
    await app.close();
  });
  it('rejects malformed, unknown, conflicting request and adapter write errors', async () => {
    const provider = new Provider(); const app = createServer(project, provider);
    expect((await app.inject({ method: 'PUT', url: `/api/images/${id}/tags`, headers, payload: { add: ['unknown'] } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: `/api/images/${id}/tags`, headers, payload: { add: ['boston', 'maine'] } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: `/api/images/${'f'.repeat(24)}/tags`, headers, payload: { add: ['maine'] } })).statusCode).toBe(404);
    expect((await app.inject(`/api/images/${'f'.repeat(24)}/preview`)).statusCode).toBe(404);
    provider.readOnly = true;
    expect((await app.inject({ method: 'PUT', url: `/api/images/${id}/tags`, headers, payload: { add: ['maine'] } })).statusCode).toBe(409);
    provider.readOnly = false;
    provider.fail = true;
    const failed = await app.inject({ method: 'PUT', url: `/api/images/${id}/tags`, headers, payload: { add: ['maine'] } });
    expect(failed.statusCode).toBe(500);
    expect(failed.body).not.toContain('maine');
    await app.close();
  });
});
