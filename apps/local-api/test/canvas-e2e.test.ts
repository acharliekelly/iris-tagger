import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { loadProjectConfig } from '../../../packages/config/src/load-config.js';
import { CanvasImageProvider } from '../../../packages/adapters/local-metadata/src/canvas-image-provider.js';
import type { MetadataStore } from '../../../packages/adapters/local-metadata/src/metadata-store.js';
import type { LocalMetadataConfig } from '../../../packages/core/src/types.js';
import { createServer } from '../src/server.js';
const tempDirs: string[] = [];
class FixtureMetadata implements MetadataStore {
  values = new Map<string, string[]>(); fail = false;
  async readKeywords(filePath: string): Promise<string[]> { return this.values.get(filePath) ?? []; }
  async writeKeywords(filePath: string, _field: string, keywords: string[]): Promise<void> { if (this.fail) throw new Error('simulated write failure'); this.values.set(filePath, [...keywords]); }
}
async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'iris-canvas-e2e-')); tempDirs.push(root);
  const project = await loadProjectConfig(path.resolve('configs/canvas.project.json'));
  const local: LocalMetadataConfig = { schemaVersion: 1, adapter: 'local-metadata', imageRoot: root, metadataField: 'XMP-dc:Subject', writableExtensions: ['.png'], keywordByTagId: { people: 'People', landscape: 'Landscape', boston: 'Boston', maine: 'Maine', 'shows-face': 'ShowsFace' } };
  const imagePath = path.join(root, 'fixture.png');
  await sharp({ create: { width: 3, height: 2, channels: 3, background: { r: 110, g: 45, b: 210 } } }).png().toFile(imagePath);
  const originalPixels = await sharp(imagePath).raw().toBuffer();
  const metadata = new FixtureMetadata(); metadata.values.set(imagePath, ['Unmanaged keyword']);
  const provider = await CanvasImageProvider.create(project, local, metadata);
  return { root, project, metadata, provider, imagePath, originalPixels };
}
afterEach(async () => { await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
describe('CANVAS adapter/API integration', () => {
  it('lists, previews and updates fixture tags while retaining unmanaged keywords and pixels', async () => {
    const { project, metadata, provider, imagePath, originalPixels } = await setup();
    const app = createServer(project, provider);
    const listed = await app.inject('/api/images');
    const [image] = listed.json();
    expect(image.tagIds).toEqual([]);
    const preview = await app.inject(`/api/images/${image.image.id}/preview`);
    expect(preview.statusCode).toBe(200);
    expect(preview.headers['cache-control']).toBe('no-store');
    const updated = await app.inject({ method: 'PUT', url: `/api/images/${image.image.id}/tags`, headers: { host: '127.0.0.1:4174', origin: 'http://127.0.0.1:4174' }, payload: { add: ['people', 'shows-face'] } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().tagIds).toEqual(['people', 'shows-face']);
    expect(metadata.values.get(imagePath)).toEqual(['Unmanaged keyword', 'People', 'ShowsFace']);
    expect(await sharp(imagePath).raw().toBuffer()).toEqual(originalPixels);
    await app.close();
  });
  it('returns an error after failed write and the image root can be unavailable', async () => {
    const { root, project, metadata, provider } = await setup();
    const app = createServer(project, provider);
    const [image] = (await app.inject('/api/images')).json();
    metadata.fail = true;
    const failed = await app.inject({ method: 'PUT', url: `/api/images/${image.image.id}/tags`, headers: { host: '127.0.0.1:4174', origin: 'http://127.0.0.1:4174' }, payload: { add: ['people'] } });
    expect(failed.statusCode).toBe(500); expect(failed.body).not.toContain('people');
    await app.close();
    await rm(root, { recursive: true, force: true });
    const unavailable = await provider.listImages().catch((error: Error) => error);
    expect(unavailable).toBeInstanceOf(Error);
  });
});
