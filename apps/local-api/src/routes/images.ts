import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { ImageNotFoundError, ImageReadOnlyError } from '../../../../packages/core/src/errors.js';
import type { ImageProvider, ProjectConfig, TagMutation } from '../../../../packages/core/src/types.js';
import { requireLocalMutation, requireLoopbackHost } from '../security.js';
const opaqueId = z.string().regex(/^[a-f0-9]{24}$/);
const mutationSchema = z.object({ add: z.array(z.string().min(1)).optional(), remove: z.array(z.string().min(1)).optional(), restore: z.array(z.string().min(1)).optional() }).strict();
function validateMutation(mutation: TagMutation, project: ProjectConfig): string | undefined {
  const known = new Set([...project.groups.flatMap((group) => group.tags.map((tag) => tag.id)), ...project.booleanTags.map((tag) => tag.id)]);
  if (mutation.restore !== undefined && (mutation.add !== undefined || mutation.remove !== undefined)) return 'Restore cannot be combined with add or remove';
  const ids = [...(mutation.add ?? []), ...(mutation.remove ?? []), ...(mutation.restore ?? [])];
  if (ids.some((id) => !known.has(id))) return 'Mutation includes unknown tag ids';
  if (mutation.restore !== undefined) return undefined;
  for (const group of project.groups.filter((item) => item.selection === 'one')) {
    const adding = (mutation.add ?? []).filter((id) => group.tags.some((tag) => tag.id === id));
    if (new Set(adding).size > 1) return `Only one tag from the ${group.id} group can be added per request`;
  }
  return undefined;
}
export async function registerImageRoutes(app: FastifyInstance, project: ProjectConfig, provider: ImageProvider, devUiOrigin?: string): Promise<void> {
  app.get('/api/images', { preHandler: requireLoopbackHost }, async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try { return await provider.listImages(); } catch { return reply.code(503).send({ error: 'Unable to list images' }); }
  });
  app.get<{ Params: { imageId: string } }>('/api/images/:imageId/preview', { preHandler: requireLoopbackHost }, async (request, reply) => {
    if (!opaqueId.safeParse(request.params.imageId).success) return reply.code(404).send({ error: 'Image not found' });
    try { const preview = await provider.getPreview(request.params.imageId); return reply.header('Cache-Control', 'no-store').type('image/jpeg').send(Buffer.from(preview)); }
    catch { return reply.code(404).send({ error: 'Image not found' }); }
  });
  app.put<{ Params: { imageId: string }; Body: unknown }>('/api/images/:imageId/tags', { preHandler: requireLocalMutation(devUiOrigin) }, async (request, reply) => {
    if (!opaqueId.safeParse(request.params.imageId).success) return reply.code(404).send({ error: 'Image not found' });
    const parsed = mutationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid tag mutation' });
    const invalid = validateMutation(parsed.data, project);
    if (invalid) return reply.code(400).send({ error: invalid });
    try { return await provider.updateTags(request.params.imageId, parsed.data); }
    catch (error) { if (error instanceof ImageNotFoundError) return reply.code(404).send({ error: 'Image not found' }); if (error instanceof ImageReadOnlyError) return reply.code(409).send({ error: 'Image is read-only' }); return reply.code(500).send({ error: 'Unable to update image tags' }); }
  });
}
