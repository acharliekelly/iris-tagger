import { describe, expect, it } from 'vitest';
import { applyTag, removeTag } from '../src/tag-transitions.js';
import type { ProjectConfig } from '../src/types.js';

const project: ProjectConfig = {
  schemaVersion: 1,
  id: 'test',
  name: 'Test',
  groups: [
    { id: 'kind', label: 'Kind', selection: 'one', tags: [{ id: 'person', label: 'Person' }, { id: 'landscape', label: 'Landscape' }] },
    { id: 'mood', label: 'Mood', selection: 'many', tags: [{ id: 'calm', label: 'Calm' }, { id: 'bright', label: 'Bright' }] },
  ],
  booleanTags: [{ id: 'shows-face', label: 'Shows face' }],
};

describe('tag transitions', () => {
  it('replaces the existing value in a one-choice group', () => {
    expect(applyTag(['person'], 'landscape', project)).toEqual({ next: ['landscape'], replaced: ['person'] });
  });
  it('allows multiple values in a many-choice group', () => {
    expect(applyTag(['calm'], 'bright', project).next).toEqual(['calm', 'bright']);
  });
  it('adds and removes independent boolean tags', () => {
    expect(applyTag([], 'shows-face', project).next).toEqual(['shows-face']);
    expect(removeTag(['shows-face', 'calm'], 'shows-face')).toEqual(['calm']);
  });
  it('explicitly resolves all existing values in a one-choice conflict', () => {
    expect(applyTag(['person', 'landscape'], 'person', project)).toEqual({ next: ['person'], replaced: ['landscape'] });
  });
  it('rejects unknown tag ids', () => {
    expect(() => applyTag([], 'unknown', project)).toThrow(/Unknown tag/);
  });
});
