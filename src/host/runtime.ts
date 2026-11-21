import { FileSideChatRepository } from '../domain/file-repository.ts'
import { SideChatService } from '../domain/service.ts'
import { SideChatCoordinator } from './coordinator.ts'
import type { SideChatAccess, SideSessionPort } from './coordinator.ts'

/**
 * Binds the Host domain to a single-process persistence file and explicit
 * DSH adapters. A production plugin must supply authenticated access and a
 * session port before exposing any action to a Web Client.
 */
export function createSideChatHostRuntime(
  metadataFile: string,
  access: SideChatAccess,
  sessions: SideSessionPort,
): SideChatCoordinator {
  const repository = new FileSideChatRepository(metadataFile)
  return new SideChatCoordinator(new SideChatService(repository), access, sessions)
}
