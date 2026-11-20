import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SideNotesRpcRouter, AuthenticatedPeer, SideRpcResult } from './rpc.ts'
import { SIDENOTES_CHANNEL } from '../shared/channel.ts'

const MAX_RPC_BYTES = 96 * 1024

export interface AuthenticatedWebServer {
  register(route: {
    kind: 'prefix'
    path: string
    auth: 'required'
    handler: (req: IncomingMessage, res: ServerResponse, peer?: AuthenticatedPeer) => Promise<void>
  }): () => void | Promise<void>
}

function respond(res: ServerResponse, status: number, result: unknown): void {
  if (res.destroyed) return
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(result))
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const part of req) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part)
    size += chunk.byteLength
    if (size > MAX_RPC_BYTES) throw new Error('request too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

interface Envelope {
  type: 'client-request'
  rpcId: string
  method: string
  payload: unknown
}

function envelope(value: unknown): value is Envelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return record.type === 'client-request' &&
    typeof record.rpcId === 'string' && record.rpcId.length <= 128 &&
    typeof record.method === 'string' && typeof record.payload === 'object'
}

function refused(code: string, message: string): SideRpcResult {
  return { ok: false, error: { code, message, details: {} } }
}

/**
 * Direct WebServer route instead of the Connection RPC registry.
 * DSH WebServer authenticates the caller (auth: required) and applies the
 * installed Connection origin/source policy before calling this handler.
 * The SideNotes router separately enforces owner-only and Session checks.
 */
export function registerSideNotesWebRoute(
  server: AuthenticatedWebServer,
  router: SideNotesRpcRouter,
  authenticate: (req: IncomingMessage) => AuthenticatedPeer | undefined,
): () => void | Promise<void> {
  return server.register({
    kind: 'prefix',
    path: SIDENOTES_CHANNEL,
    auth: 'required',
    async handler(req, res, peer) {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
      const prefix = SIDENOTES_CHANNEL + '/'
      const method = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : ''
      if (req.method !== 'POST' || !/^[a-z][a-z-]*$/u.test(method)) {
        respond(res, 404, { error: 'not found' })
        return
      }
      // DSH's released Web carrier can omit a Peer from plugin handler
      // arguments. Re-admit through the official Connection trust and token
      // provider instead of accepting an anonymous request.
      const admitted = peer ?? authenticate(req)
      if (!admitted) {
        respond(res, 401, { error: 'unauthorized' })
        return
      }
      let request: unknown
      try {
        request = await readBody(req)
      } catch {
        respond(res, 400, { error: 'invalid or oversized JSON request' })
        return
      }
      if (!envelope(request) || request.method !== method) {
        respond(res, 400, { error: 'invalid request envelope' })
        return
      }
      try {
        const result = await router.handle(admitted, method, request.payload)
        respond(res, 200, {
          type: 'server-response',
          rpcId: request.rpcId,
          result,
        })
      } catch {
        respond(res, 200, {
          type: 'server-response',
          rpcId: request.rpcId,
          result: refused('sidenotes/operation-failed', 'SideNotes operation failed'),
        })
      }
    },
  })
}
