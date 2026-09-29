import Fastify from 'fastify';
import type { ImageProvider, ProjectConfig } from '../../../packages/core/src/types.js';
import { registerImageRoutes } from './routes/images.js';
import { registerProjectRoutes } from './routes/project.js';
export function createServer(project: ProjectConfig, provider: ImageProvider, options: { devUiOrigin?: string } = {}) {
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 });
  void registerProjectRoutes(app, project);
  void registerImageRoutes(app, project, provider, options.devUiOrigin);
  return app;
}
