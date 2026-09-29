import type { ProjectConfig } from './types.js';

function findTag(config: ProjectConfig, tagId: string): { selection: 'one' | 'many' } | { boolean: true } {
  for (const group of config.groups) if (group.tags.some((tag) => tag.id === tagId)) return { selection: group.selection };
  if (config.booleanTags.some((tag) => tag.id === tagId)) return { boolean: true };
  throw new Error(`Unknown tag: ${tagId}`);
}
export function applyTag(current: string[], tagId: string, config: ProjectConfig): { next: string[]; replaced: string[] } {
  const definition = findTag(config, tagId);
  const existing = [...new Set(current)];
  if ('boolean' in definition || definition.selection === 'many') return { next: existing.includes(tagId) ? existing : [...existing, tagId], replaced: [] };
  const group = config.groups.find((candidate) => candidate.tags.some((tag) => tag.id === tagId))!;
  const members = new Set(group.tags.map((tag) => tag.id));
  const replaced = existing.filter((id) => id !== tagId && members.has(id));
  return { next: [...existing.filter((id) => !members.has(id)), tagId], replaced };
}
export function removeTag(current: string[], tagId: string): string[] { return current.filter((id) => id !== tagId); }
export function getConflictedGroupIds(tagIds: string[], config: ProjectConfig): string[] {
  const assigned = new Set(tagIds);
  return config.groups.filter((group) => group.selection === 'one' && group.tags.filter((tag) => assigned.has(tag.id)).length > 1).map((group) => group.id);
}
