import { readFile } from 'node:fs/promises';
import type { ProjectConfig, LocalMetadataConfig } from '../../core/src/types.js';
import { validateLocalMetadataConfig, validateProjectConfig } from './schema.js';
export async function loadProjectConfig(filePath: string): Promise<ProjectConfig> { return validateProjectConfig(JSON.parse(await readFile(filePath, 'utf8')) as unknown); }
export async function loadLocalMetadataConfig(filePath: string, project: ProjectConfig): Promise<LocalMetadataConfig> { return validateLocalMetadataConfig(JSON.parse(await readFile(filePath, 'utf8')) as unknown, project); }
