import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CanvasImageProvider } from '../src/canvas-image-provider.js';
import type { MetadataStore } from '../src/metadata-store.js';
import type { LocalMetadataConfig, ProjectConfig } from '../../../core/src/types.js';

const dirs: string[] = [];
const project: ProjectConfig = { schemaVersion: 1, id: 'test', name: 'Test', groups: [{ id: 'place', label: 'Place', selection: 'one', tags: [{ id: 'boston', label: 'Boston' }, { id: 'maine', label: 'Maine' }] }], booleanTags: [{ id: 'face', label: 'Shows face' }] };
class FakeMetadata implements MetadataStore {
  data = new Map<string, string[]>(); fail = false;
  async readKeywords(file: string) { return this.data.get(file) ?? []; }
  async writeKeywords(file: string, _field: string, values: string[]) { if (this.fail) throw new Error('fixture write failed'); this.data.set(file, values); }
}
async function providerSetup(store = new FakeMetadata()) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'iris-provider-')); dirs.push(root);
  const file = path.join(root, 'sample.jpg'); await writeFile(file, 'fixture');
  const local: LocalMetadataConfig = { schemaVersion: 1, adapter: 'local-metadata', imageRoot: root, metadataField: 'XMP-dc:Subject', writableExtensions: ['.jpg'], keywordByTagId: { boston: 'Boston', maine: 'Maine', face: 'ShowsFace' } };
  store.data.set(file, ['ExistingOtherKeyword', 'Boston']);
  return { provider: await CanvasImageProvider.create(project, local, store), store, file };
}
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe('CanvasImageProvider', () => {
  it('maps managed keywords and reports existing single-choice conflicts', async () => {
    const { provider, store, file } = await providerSetup();
    store.data.set(file, ['Boston', 'Maine', 'Unmanaged']);
    const [image] = await provider.listImages();
    expect(image.tagIds).toEqual(['boston', 'maine']);
    expect(image.conflictedGroupIds).toEqual(['place']);
  });
  it('replaces managed values and preserves unrelated keywords', async () => {
    const { provider, store, file } = await providerSetup();
    const [image] = await provider.listImages();
    const result = await provider.updateTags(image.image.id, { add: ['maine', 'face'] });
    expect(result).toMatchObject({ tagIds: ['maine', 'face'], replacedTagIds: ['boston'], conflictedGroupIds: [] });
    expect(store.data.get(file)).toEqual(['ExistingOtherKeyword', 'Maine', 'ShowsFace']);
  });
  it('restores an exact prior assignment including a pre-existing conflict', async () => {
    const { provider, store, file } = await providerSetup();
    const [image] = await provider.listImages();
    store.data.set(file, ['ExistingOtherKeyword', 'Boston', 'Maine']);
    const restored = await provider.updateTags(image.image.id, { restore: ['boston', 'maine'] });
    expect(restored).toMatchObject({ tagIds: ['boston', 'maine'], conflictedGroupIds: ['place'] });
    expect(store.data.get(file)).toEqual(['ExistingOtherKeyword', 'Boston', 'Maine']);
  });
  it('serializes concurrent updates to one image so neither assignment is lost', async () => {
    class SlowMetadata extends FakeMetadata {
      override async writeKeywords(file: string, field: string, values: string[]) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        await super.writeKeywords(file, field, values);
      }
    }
    const store = new SlowMetadata();
    const { provider, file } = await providerSetup(store);
    const [image] = await provider.listImages();
    await Promise.all([provider.updateTags(image.image.id, { add: ['maine'] }), provider.updateTags(image.image.id, { add: ['face'] })]);
    expect(store.data.get(file)).toEqual(['ExistingOtherKeyword', 'Maine', 'ShowsFace']);
  });
  it('handles missing keyword metadata and surfaces write failures', async () => {
    const { provider, store, file } = await providerSetup();
    store.data.delete(file);
    const [image] = await provider.listImages();
    expect(image.tagIds).toEqual([]);
    store.fail = true;
    await expect(provider.updateTags(image.image.id, { add: ['face'] })).rejects.toThrow(/fixture write failed/);
  });
});
