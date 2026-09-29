import { spawn } from 'node:child_process';
import type { MetadataStore } from './metadata-store.js';

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('exiftool', args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`ExifTool exited ${code}: ${stderr.trim()}`)));
  });
}
function validateField(field: string): void {
  if (!/^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(field)) throw new Error('Invalid ExifTool metadata field');
}
export class ExifToolKeywordStore implements MetadataStore {
  async readKeywords(filePath: string, field: string): Promise<string[]> {
    validateField(field);
    const output = await run(['-json', `-${field}`, filePath]);
    const [record] = JSON.parse(output) as Record<string, unknown>[];
    const values = record?.[field.split(':').at(-1)!];
    if (values === undefined || values === null) return [];
    return (Array.isArray(values) ? values : [values]).map(String);
  }
  async writeKeywords(filePath: string, field: string, keywords: string[]): Promise<void> {
    validateField(field);
    const args = ['-overwrite_original', `-${field}=`];
    for (const keyword of keywords) args.push(`-${field}+=${keyword}`);
    args.push(filePath);
    await run(args);
  }
}
