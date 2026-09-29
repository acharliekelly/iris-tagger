import { createHash } from 'node:crypto';
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { LocalMetadataConfig } from '../../../core/src/types.js';
import { ImageNotFoundError } from '../../../core/src/errors.js';

export type LocalImage = { id: string; fileName: string; mimeType: string; writable: boolean; path: string };
const mimeByExtension: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.heic': 'image/heic', '.avif': 'image/avif' };
const within = (root: string, candidate: string): boolean => candidate === root || candidate.startsWith(root + path.sep);

export class FilesystemImageSource {
  private readonly root: string;
  private readonly byId = new Map<string, string>();
  private readonly extensions: Set<string>;

  private constructor(root: string, extensions: string[]) {
    this.root = root;
    this.extensions = new Set(extensions.map((extension) => extension.toLowerCase()));
  }
  static async create(config: LocalMetadataConfig): Promise<FilesystemImageSource> {
    const root = await realpath(config.imageRoot);
    const stat = await lstat(root);
    if (!stat.isDirectory()) throw new Error('Configured imageRoot is not a directory');
    return new FilesystemImageSource(root, config.writableExtensions);
  }
  async listImages(): Promise<LocalImage[]> {
    this.byId.clear();
    const found: LocalImage[] = [];
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) { await visit(absolute); continue; }
        if (!entry.isFile()) continue;
        const extension = path.extname(entry.name).toLowerCase();
        const mimeType = mimeByExtension[extension];
        if (!mimeType) continue;
        const resolved = await realpath(absolute);
        if (!within(this.root, resolved)) continue;
        const relative = path.relative(this.root, resolved);
        const id = createHash('sha256').update(relative).digest('hex').slice(0, 24);
        this.byId.set(id, resolved);
        found.push({ id, fileName: entry.name, mimeType, writable: this.extensions.has(extension), path: resolved });
      }
    };
    await visit(this.root);
    return found.sort((a, b) => a.path.localeCompare(b.path));
  }
  async resolve(imageId: string): Promise<LocalImage> {
    const filePath = this.byId.get(imageId);
    if (!filePath) throw new ImageNotFoundError();
    const resolved = await realpath(filePath);
    if (!within(this.root, resolved)) throw new Error('Image is outside configured imageRoot');
    const stat = await lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Image is no longer a regular file');
    const extension = path.extname(filePath).toLowerCase();
    return { id: imageId, fileName: path.basename(filePath), mimeType: mimeByExtension[extension] ?? 'application/octet-stream', writable: this.extensions.has(extension), path: resolved };
  }
}
