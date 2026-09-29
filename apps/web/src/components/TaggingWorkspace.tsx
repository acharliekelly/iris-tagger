import { useCallback, useEffect, useMemo, useState } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import type { ImageWithTags, ProjectConfig, TagMutation } from '../../../../packages/core/src/types.js';
import { fetchImages, fetchPreview, updateImageTags } from '../api/client.js';
import { ImageGrid } from './ImageGrid.js';
import { TagBins } from './TagBins.js';
type UndoAction = { imageId: string; previousTagIds: string[] };
export function TaggingWorkspace({ project }: { project: ProjectConfig }) {
  const [images, setImages] = useState<ImageWithTags[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<UndoAction>();
  useEffect(() => {
    let active = true;
    void fetchImages().then(async (items) => {
      if (!active) return;
      setImages(items);
      setSelectedId(items[0]?.image.id);
      const entries = await Promise.all(items.map(async (item) => {
        try { return [item.image.id, await fetchPreview(item.image.id)] as const; } catch { return [item.image.id, ''] as const; }
      }));
      if (active) setPreviews(Object.fromEntries(entries.filter(([, src]) => src)));
    }).catch(() => { if (active) setError('Unable to load images. Check the local adapter settings.'); });
    return () => { active = false; };
  }, []);
  const selected = images.find((item) => item.image.id === selectedId);
  const update = useCallback(async (imageId: string, mutation: TagMutation, undoAction?: UndoAction) => {
    if (pending) return;
    const image = images.find((item) => item.image.id === imageId);
    if (!image || !image.image.writable) return;
    setPending(true); setError('');
    try {
      const result = await updateImageTags(imageId, mutation);
      setImages((current) => current.map((item) => item.image.id === imageId ? { ...item, tagIds: result.tagIds, conflictedGroupIds: result.conflictedGroupIds } : item));
      setUndo(undoAction);
    } catch { setError('Unable to update tags. Your confirmed assignments are unchanged.'); }
    finally { setPending(false); }
  }, [images, pending]);
  const toggleTag = (tagId: string) => {
    if (!selected || pending) return;
    const isApplied = selected.tagIds.includes(tagId);
    const undoAction = { imageId: selected.image.id, previousTagIds: [...selected.tagIds] };
    if (isApplied) void update(selected.image.id, { remove: [tagId] }, undoAction);
    else void update(selected.image.id, { add: [tagId] }, undoAction);
  };
  const assigned = useMemo(() => selected?.tagIds ?? [], [selected]);
  const handleDrop = (event: { canceled?: boolean; operation: { source?: { id: string | number } | null; target?: { id: string | number } | null } }) => {
    if (event.canceled || !event.operation.target) return;
    const tagTarget = String(event.operation.target.id);
    if (tagTarget.startsWith('tag:') && event.operation.source) {
      const imageId = String(event.operation.source.id);
      if (imageId === selectedId || images.some((item) => item.image.id === imageId)) {
        setSelectedId(imageId);
        const item = images.find((candidate) => candidate.image.id === imageId);
        const tagId = tagTarget.slice(4);
        if (!item?.tagIds.includes(tagId)) void update(imageId, { add: [tagId] }, { imageId, previousTagIds: [...(item?.tagIds ?? [])] });
      }
    }
  };
  const undoLast = () => { if (undo) { const action = undo; setUndo(undefined); void update(action.imageId, { restore: action.previousTagIds }); } };
  return <DragDropProvider onDragEnd={handleDrop}>
    <main className="workspace">
      <header><div><p className="eyebrow">IRIS · LOCAL IMAGE TAGGER</p><h1>{project.name}</h1><p>Select an image, then add tags by dragging it to a bin or clicking a bin.</p></div><div className="image-count">{images.length} images</div></header>
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="workspace-columns"><div className="gallery-column"><div className="column-heading"><h2>Images</h2><span>{selected ? selected.image.fileName : 'Select an image'}</span></div><ImageGrid images={images} selectedId={selectedId} previews={previews} onSelect={setSelectedId} /></div>
      <div className="tag-column"><div className="column-heading"><h2>Tags</h2><span>{pending ? 'Saving…' : 'Click an applied tag to remove it'}</span></div><TagBins project={project} tagIds={assigned} onToggle={toggleTag} />{selected && !selected.image.writable && <p className="read-only-note">Read-only: {selected.image.readOnlyReason}</p>}{undo && <button className="undo-button" onClick={undoLast} disabled={pending}>Undo last tag change</button>}</div></div>
    </main>
  </DragDropProvider>;
}
