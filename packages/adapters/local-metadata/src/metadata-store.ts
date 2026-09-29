export interface MetadataStore {
  readKeywords(filePath: string, field: string): Promise<string[]>;
  writeKeywords(filePath: string, field: string, keywords: string[]): Promise<void>;
}
