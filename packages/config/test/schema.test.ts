import { describe, expect, it } from 'vitest';
import { validateLocalMetadataConfig, validateProjectConfig } from '../src/schema.js';

const validProject = { schemaVersion: 1, id: 'canvas', name: 'CANVAS', groups: [{ id: 'kind', label: 'Kind', selection: 'one', tags: [{ id: 'person', label: 'Person' }] }], booleanTags: [{ id: 'face', label: 'Shows face' }] };
const validLocal = { schemaVersion: 1, adapter: 'local-metadata', imageRoot: '/images', metadataField: 'XMP-dc:Subject', writableExtensions: ['.jpg'], keywordByTagId: { person: 'People', face: 'ShowsFace' } };

describe('project config validation', () => {
  it('accepts a valid project', () => expect(validateProjectConfig(validProject).id).toBe('canvas'));
  it('rejects duplicate tag ids', () => expect(() => validateProjectConfig({ ...validProject, booleanTags: [{ id: 'person', label: 'dup' }] })).toThrow());
  it('rejects invalid cardinality', () => expect(() => validateProjectConfig({ ...validProject, groups: [{ ...validProject.groups[0], selection: 'some' }] })).toThrow());
  it('rejects unknown schema versions', () => expect(() => validateProjectConfig({ ...validProject, schemaVersion: 2 })).toThrow());
});

describe('local adapter config validation', () => {
  it('accepts complete mappings', () => expect(validateLocalMetadataConfig(validLocal, validateProjectConfig(validProject)).adapter).toBe('local-metadata'));
  it('rejects incomplete tag mappings', () => expect(() => validateLocalMetadataConfig({ ...validLocal, keywordByTagId: { person: 'People' } }, validateProjectConfig(validProject))).toThrow());
  it('rejects extra tag mappings', () => expect(() => validateLocalMetadataConfig({ ...validLocal, keywordByTagId: { ...validLocal.keywordByTagId, extra: 'Other' } }, validateProjectConfig(validProject))).toThrow());
  it('rejects duplicate keyword mappings', () => expect(() => validateLocalMetadataConfig({ ...validLocal, keywordByTagId: { person: 'Same', face: 'Same' } }, validateProjectConfig(validProject))).toThrow());
  it('rejects unsupported schema versions and non-absolute roots', () => {
    const project = validateProjectConfig(validProject);
    expect(() => validateLocalMetadataConfig({ ...validLocal, schemaVersion: 2 }, project)).toThrow();
    expect(() => validateLocalMetadataConfig({ ...validLocal, imageRoot: 'relative/path' }, project)).toThrow();
    expect(() => validateLocalMetadataConfig({ ...validLocal, metadataField: 'REPLACE_AFTER_COMPATIBILITY_PROBE' }, project)).toThrow();
  });
});
