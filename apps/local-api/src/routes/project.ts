import type { FastifyInstance } from 'fastify';
import { requireLoopbackHost } from '../security.js';
import type { ProjectConfig } from '../../../../packages/core/src/types.js';
export async function registerProjectRoutes(app: FastifyInstance, project: ProjectConfig): Promise<void> {
  app.get('/api/project', { preHandler: requireLoopbackHost }, async () => project);
}
