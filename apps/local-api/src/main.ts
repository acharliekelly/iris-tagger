import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalMetadataConfig, loadProjectConfig } from '../../../packages/config/src/load-config.js';
import { CanvasImageProvider } from '../../../packages/adapters/local-metadata/src/canvas-image-provider.js';
import { createServer } from './server.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const project = await loadProjectConfig(path.join(repo, 'configs/canvas.project.json'));
const local = await loadLocalMetadataConfig(path.join(repo, 'configs/canvas.local.json'), project);
const provider = await CanvasImageProvider.create(project, local);
const app = createServer(project, provider, { devUiOrigin: process.env.IRIS_UI_ORIGIN });
const webRoot = path.join(repo, 'apps/local-api/web-dist');
try {
  const stat = await import('node:fs/promises').then(({ stat }) => stat(webRoot));
  if (stat.isDirectory()) {
    const { default: fastifyStatic } = await import('@fastify/static');
    await app.register(fastifyStatic, { root: webRoot, prefix: '/' });
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' });
      return reply.type('text/html').sendFile('index.html');
    });
  }
} catch { /* Development uses Vite as a separate local server. */ }
const port = Number(process.env.IRIS_PORT ?? 4174);
await app.listen({ host: '127.0.0.1', port });
console.log(`Iris API listening on http://127.0.0.1:${port}`);
