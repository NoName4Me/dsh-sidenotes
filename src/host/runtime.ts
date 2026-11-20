import { FileSideNoteRepository } from '../domain/file-repository.ts'
import { SideNoteService } from '../domain/service.ts'
import { SideNoteCoordinator } from './coordinator.ts'
import type { SideNoteAccess, SideSessionPort } from './coordinator.ts'

/**
 * Binds the Host domain to a single-process persistence file and explicit
 * DSH adapters. A production plugin must supply authenticated access and a
 * session port before exposing any action to a Web Client.
 */
export function createSideNoteHostRuntime(
  metadataFile: string,
  access: SideNoteAccess,
  sessions: SideSessionPort,
): SideNoteCoordinator {
  const repository = new FileSideNoteRepository(metadataFile)
  return new SideNoteCoordinator(new SideNoteService(repository), access, sessions)
}
