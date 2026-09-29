import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TaggingWorkspace } from './TaggingWorkspace.js';
import * as api from '../api/client.js';
import type { ImageWithTags, ProjectConfig } from '../../../../packages/core/src/types.js';
const dragEvents = vi.hoisted(() => ({ onDragEnd: undefined as ((event: { canceled?: boolean; operation: { source?: { id: string }; target?: { id: string } } }) => void) | undefined }));
vi.mock('@dnd-kit/react', () => ({
  DragDropProvider: ({ children, onDragEnd }: { children: unknown; onDragEnd: typeof dragEvents.onDragEnd }) => { dragEvents.onDragEnd = onDragEnd; return createElement('div', null, children as never); },
  useDraggable: () => ({ ref: () => undefined }),
  useDroppable: () => ({ ref: () => undefined, isDropTarget: false }),
}));
vi.mock('../api/client.js');
const project: ProjectConfig = { schemaVersion: 1, id: 'demo', name: 'Demo', groups: [{ id: 'place', label: 'Place', selection: 'one', tags: [{ id: 'boston', label: 'Boston' }, { id: 'maine', label: 'Maine' }] }], booleanTags: [{ id: 'face', label: 'Shows face' }] };
const images: ImageWithTags[] = [
  { image: { id: '1'.repeat(24), fileName: 'one.jpg', mimeType: 'image/jpeg', writable: true }, tagIds: ['boston'], conflictedGroupIds: [] },
  { image: { id: '2'.repeat(24), fileName: 'two.jpg', mimeType: 'image/jpeg', writable: false, readOnlyReason: 'Unsupported format' }, tagIds: [], conflictedGroupIds: [] },
  { image: { id: '3'.repeat(24), fileName: 'conflict.jpg', mimeType: 'image/jpeg', writable: true }, tagIds: ['boston', 'maine'], conflictedGroupIds: ['place'] },
];
describe('TaggingWorkspace', () => {
  beforeEach(() => {
    vi.mocked(api.fetchImages).mockResolvedValue(images);
    vi.mocked(api.fetchPreview).mockResolvedValue('data:image/jpeg;base64,AA==');
    vi.mocked(api.updateImageTags).mockResolvedValue({ tagIds: ['maine'], replacedTagIds: ['boston'], conflictedGroupIds: [] });
  });
  it('highlights the selected image tags and shows read-only images', async () => {
    render(<TaggingWorkspace project={project} />);
    await screen.findByRole('button', { name: /one.jpg/i });
    expect(screen.getByRole('button', { name: /^Boston/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/needs conflict repair/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /two.jpg/i }));
    expect(screen.getAllByText(/read-only/i).length).toBeGreaterThan(0);
  });
  it('applies and removes tags through bin clicks, then supports undo for replacement', async () => {
    render(<TaggingWorkspace project={project} />);
    await screen.findByRole('button', { name: /one.jpg/i });
    fireEvent.click(screen.getByRole('button', { name: /^Maine/ }));
    await waitFor(() => expect(api.updateImageTags).toHaveBeenCalledWith('1'.repeat(24), { add: ['maine'] }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Maine/ })).toHaveAttribute('aria-pressed', 'true'));
    expect(await screen.findByRole('button', { name: /undo/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    await waitFor(() => expect(api.updateImageTags).toHaveBeenLastCalledWith('1'.repeat(24), { restore: ['boston'] }));
  });
  it('undo restores a pre-existing single-choice conflict exactly', async () => {
    vi.mocked(api.updateImageTags).mockResolvedValueOnce({ tagIds: ['maine'], replacedTagIds: [], conflictedGroupIds: [] });
    render(<TaggingWorkspace project={project} />);
    await screen.findByRole('button', { name: /conflict.jpg/i });
    fireEvent.click(screen.getByRole('button', { name: /conflict.jpg/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Boston/ }));
    await waitFor(() => expect(api.updateImageTags).toHaveBeenCalledWith('3'.repeat(24), { remove: ['boston'] }));
    fireEvent.click(await screen.findByRole('button', { name: /undo last tag change/i }));
    await waitFor(() => expect(api.updateImageTags).toHaveBeenLastCalledWith('3'.repeat(24), { restore: ['boston', 'maine'] }));
  });
  it('adds a tag when an image is dropped on a bin', async () => {
    render(<TaggingWorkspace project={project} />);
    await screen.findByRole('button', { name: /one.jpg/i });
    dragEvents.onDragEnd?.({ operation: { source: { id: '1'.repeat(24) }, target: { id: 'tag:maine' } } });
    await waitFor(() => expect(api.updateImageTags).toHaveBeenCalledWith('1'.repeat(24), { add: ['maine'] }));
  });
  it('removes an applied tag on a successful click', async () => {
    vi.mocked(api.updateImageTags).mockResolvedValueOnce({ tagIds: [], replacedTagIds: [], conflictedGroupIds: [] });
    render(<TaggingWorkspace project={project} />);
    await screen.findByRole('button', { name: /one.jpg/i });
    fireEvent.click(screen.getByRole('button', { name: /^Boston/ }));
    await waitFor(() => expect(api.updateImageTags).toHaveBeenCalledWith('1'.repeat(24), { remove: ['boston'] }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Boston/ })).toHaveAttribute('aria-pressed', 'false'));
  });
  it('removes an applied tag and retains confirmed state on update failure', async () => {
    vi.mocked(api.updateImageTags).mockRejectedValueOnce(new Error('write failed'));
    render(<TaggingWorkspace project={project} />);
    await screen.findByRole('button', { name: /one.jpg/i });
    fireEvent.click(screen.getByRole('button', { name: /^Boston/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to update/i);
    expect(screen.getByRole('button', { name: /^Boston/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/needs conflict repair/i)).toBeInTheDocument();
  });
});
