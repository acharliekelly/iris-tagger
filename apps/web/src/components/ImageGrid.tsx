import { useDraggable } from '@dnd-kit/react';
import type { ImageWithTags } from '../../../../packages/core/src/types.js';
function ImageCard({ item, selected, preview, onSelect }: { item: ImageWithTags; selected: boolean; preview?: string; onSelect: () => void }) {
  const { ref } = useDraggable({ id: item.image.id, type: 'image', disabled: !item.image.writable });
  return <button ref={ref} className={`image-card${selected ? ' selected' : ''}`} aria-label={`${item.image.fileName}${item.image.writable ? '' : ', read-only'}`} aria-pressed={selected} onClick={onSelect}>
    {preview ? <img src={preview} alt="" /> : <span className="preview-placeholder">Preview unavailable</span>}
    <span>{item.image.fileName}</span>{!item.image.writable && <small>Read-only</small>}
    {item.conflictedGroupIds.length > 0 && <small className="conflict">Needs conflict repair</small>}
  </button>;
}
export function ImageGrid({ images, selectedId, previews, onSelect }: { images: ImageWithTags[]; selectedId?: string; previews: Record<string, string>; onSelect: (id: string) => void }) {
  return <section className="image-grid" aria-label="Images">{images.map((item) => <ImageCard key={item.image.id} item={item} selected={item.image.id === selectedId} preview={previews[item.image.id]} onSelect={() => onSelect(item.image.id)} />)}</section>;
}
