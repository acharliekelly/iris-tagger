import type { FastifyReply, FastifyRequest } from 'fastify';
const loopbackHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
export async function requireLoopbackHost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!loopbackHost.test(request.headers.host ?? '')) await reply.code(403).send({ error: 'Forbidden host' });
}
export function requireLocalMutation(devUiOrigin?: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const host = request.headers.host ?? '';
    const origin = request.headers.origin;
    if (!loopbackHost.test(host) || !origin) { await reply.code(403).send({ error: 'Forbidden origin' }); return; }
    const allowed = new Set([`http://${host}`, ...(devUiOrigin ? [devUiOrigin] : [])]);
    if (!allowed.has(origin)) await reply.code(403).send({ error: 'Forbidden origin' });
  };
}
