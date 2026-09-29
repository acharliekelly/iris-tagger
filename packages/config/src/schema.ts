import path from 'node:path';
import { z } from 'zod';
import type { LocalMetadataConfig, ProjectConfig } from '../../core/src/types.js';
const tag = z.object({ id: z.string().min(1), label: z.string().min(1) }).strict();
const projectSchema = z.object({ schemaVersion: z.literal(1), id: z.string().min(1), name: z.string().min(1), groups: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), selection: z.enum(['one', 'many']), tags: z.array(tag).min(1) }).strict()), booleanTags: z.array(tag) }).strict().superRefine((project, ctx) => {
  if (new Set(project.groups.map((group) => group.id)).size !== project.groups.length) ctx.addIssue({ code: 'custom', message: 'Group ids must be unique', path: ['groups'] });
  const tagIds = [...project.groups.flatMap((group) => group.tags.map((item) => item.id)), ...project.booleanTags.map((item) => item.id)];
  if (new Set(tagIds).size !== tagIds.length) ctx.addIssue({ code: 'custom', message: 'Tag ids must be unique across all groups and boolean tags', path: ['groups'] });
});
export function validateProjectConfig(input: unknown): ProjectConfig { return projectSchema.parse(input) as ProjectConfig; }
const localSchema = z.object({ schemaVersion: z.literal(1), adapter: z.literal('local-metadata'), imageRoot: z.string().min(1), metadataField: z.string().regex(/^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/, 'metadataField must be a verified ExifTool group:tag name'), writableExtensions: z.array(z.string().regex(/^\.[a-z0-9]+$/i).transform((ext) => ext.toLowerCase())), keywordByTagId: z.record(z.string().min(1)) }).strict();
export function validateLocalMetadataConfig(input: unknown, project: ProjectConfig): LocalMetadataConfig {
  const config = localSchema.parse(input);
  if (!path.isAbsolute(config.imageRoot)) throw new Error('imageRoot must be an absolute path');
  const ids = [...project.groups.flatMap((group) => group.tags.map((item) => item.id)), ...project.booleanTags.map((item) => item.id)].sort();
  if (JSON.stringify(ids) !== JSON.stringify(Object.keys(config.keywordByTagId).sort())) throw new Error('keywordByTagId must map every project tag exactly once and contain no unknown tag ids');
  const keywords = Object.values(config.keywordByTagId);
  if (new Set(keywords).size !== keywords.length) throw new Error('keyword mappings must be unique');
  return config as LocalMetadataConfig;
}
