import sharp from 'sharp';
import type { ImageProvider, ImageWithTags, LocalMetadataConfig, ProjectConfig, TagMutation, TagUpdateResult } from '../../../core/src/types.js';
import { ImageReadOnlyError } from '../../../core/src/errors.js';
import { applyTag, getConflictedGroupIds, removeTag } from '../../../core/src/tag-transitions.js';
import { ExifToolKeywordStore } from './exiftool-keyword-store.js';
import type { MetadataStore } from './metadata-store.js';
import { FilesystemImageSource } from './filesystem-image-source.js';

export class CanvasImageProvider implements ImageProvider {
  private readonly keywordToTag: Map<string, string>;
  private readonly updateLocks = new Map<string, Promise<void>>();

  private constructor(private readonly source: FilesystemImageSource, private readonly project: ProjectConfig, private readonly local: LocalMetadataConfig, private readonly metadata: MetadataStore) {
    this.keywordToTag = new Map(Object.entries(local.keywordByTagId).map(([id, keyword]) => [keyword, id]));
  }
  static async create(project: ProjectConfig, local: LocalMetadataConfig, metadata: MetadataStore = new ExifToolKeywordStore()): Promise<CanvasImageProvider> {
    return new CanvasImageProvider(await FilesystemImageSource.create(local), project, local, metadata);
  }
  private tagIdsFor(keywords: string[]): string[] {
    return [...new Set(keywords.flatMap((keyword) => { const id = this.keywordToTag.get(keyword); return id ? [id] : []; }))];
  }
  async listImages(): Promise<ImageWithTags[]> {
    const images = await this.source.listImages();
    return Promise.all(images.map(async (item) => {
      const tagIds = this.tagIdsFor(await this.metadata.readKeywords(item.path, this.local.metadataField));
      return { image: { id: item.id, fileName: item.fileName, mimeType: item.mimeType, writable: item.writable, ...(item.writable ? {} : { readOnlyReason: 'This format is not enabled for embedded metadata writes' }) }, tagIds, conflictedGroupIds: getConflictedGroupIds(tagIds, this.project) };
    }));
  }
  async getPreview(imageId: string): Promise<Uint8Array> {
    const image = await this.source.resolve(imageId);
    return sharp(image.path).rotate().resize({ width: 480, height: 360, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
  }
  private async withImageLock<T>(imageId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.updateLocks.get(imageId);
    let release!: () => void;
    const lock = new Promise<void>((resolve) => { release = resolve; });
    this.updateLocks.set(imageId, lock);
    if (previous) await previous;
    try { return await operation(); }
    finally { release(); if (this.updateLocks.get(imageId) === lock) this.updateLocks.delete(imageId); }
  }
  async updateTags(imageId: string, mutation: TagMutation): Promise<TagUpdateResult> {
    return this.withImageLock(imageId, async () => {
      const image = await this.source.resolve(imageId);
      if (!image.writable) throw new ImageReadOnlyError();
      const before = await this.metadata.readKeywords(image.path, this.local.metadataField);
      let tags: string[];
      const replaced = new Set<string>();
      if (mutation.restore !== undefined) {
        const known = new Set([...this.project.groups.flatMap((group) => group.tags.map((tag) => tag.id)), ...this.project.booleanTags.map((tag) => tag.id)]);
        if (mutation.restore.some((id) => !known.has(id) || !this.local.keywordByTagId[id])) throw new Error('Restore includes an unknown tag id');
        tags = [...new Set(mutation.restore)];
      } else {
        tags = this.tagIdsFor(before);
        for (const tagId of mutation.remove ?? []) tags = removeTag(tags, tagId);
        for (const tagId of mutation.add ?? []) {
          const result = applyTag(tags, tagId, this.project);
          result.replaced.forEach((id) => replaced.add(id));
          tags = result.next;
        }
      }
      const managed = new Set(Object.values(this.local.keywordByTagId));
      const desired = [...before.filter((keyword) => !managed.has(keyword)), ...tags.map((id) => this.local.keywordByTagId[id]!)];
      await this.metadata.writeKeywords(image.path, this.local.metadataField, desired);
      const confirmed = this.tagIdsFor(await this.metadata.readKeywords(image.path, this.local.metadataField));
      return { tagIds: confirmed, replacedTagIds: [...replaced], conflictedGroupIds: getConflictedGroupIds(confirmed, this.project) };
    });
  }
}
