import type { ImageWithTags, ProjectConfig, TagMutation, TagUpdateResult } from '../../../../packages/core/src/types.js';
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}
export function fetchProject(): Promise<ProjectConfig> { return request('/api/project'); }
export function fetchImages(): Promise<ImageWithTags[]> { return request('/api/images'); }
export async function fetchPreview(imageId: string): Promise<string> {
  const response = await fetch(`/api/images/${encodeURIComponent(imageId)}/preview`);
  if (!response.ok) throw new Error(`Preview unavailable (${response.status})`);
  return URL.createObjectURL(await response.blob());
}
export function updateImageTags(imageId: string, mutation: TagMutation): Promise<TagUpdateResult> {
  return request(`/api/images/${encodeURIComponent(imageId)}/tags`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mutation) });
}
