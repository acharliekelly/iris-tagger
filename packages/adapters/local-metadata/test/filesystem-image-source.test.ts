import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FilesystemImageSource } from '../src/filesystem-image-source.js';
import type { LocalMetadataConfig } from '../../../core/src/types.js';

const roots: string[] = [];
async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'iris-adapter-'));
  roots.push(root);
  const config: LocalMetadataConfig = { schemaVersion: 1, adapter: 'local-metadata', imageRoot: root, metadataField: 'XMP-dc:Subject', writableExtensions: ['.jpg'], keywordByTagId: {} };
  return { root, source: await FilesystemImageSource.create(config) };
}
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe('FilesystemImageSource', () => {
  it('lists supported image files and marks unconfigured formats read only', async () => {
    const { root, source } = await setup();
    await mkdir(path.join(root, 'nested'));
    await writeFile(path.join(root, 'nested', 'a.jpg'), 'fixture');
    await writeFile(path.join(root, 'b.gif'), 'fixture');
    await writeFile(path.join(root, 'notes.txt'), 'fixture');
    const images = await source.listImages();
    expect(images.map((image) => [image.fileName, image.writable])).toEqual([['a.jpg', true]]);
  });
  it('rejects opaque-id traversal and omits symlink escapes', async () => {
    const { root, source } = await setup();
    const outside = path.join(path.dirname(root), 'iris-outside.jpg');
    await writeFile(outside, 'fixture');
    await symlink(outside, path.join(root, 'escape.jpg'));
    expect(await source.listImages()).toEqual([]);
    await expect(source.resolve('../../etc/passwd')).rejects.toThrow(/Image not found/);
    await rm(outside, { force: true });
  });
});
