import { useDroppable } from '@dnd-kit/react';
import type { ProjectConfig } from '../../../../packages/core/src/types.js';
function Bin({ id, label, active, group, onClick }: { id: string; label: string; active: boolean; group?: string; onClick: () => void }) {
  const { ref, isDropTarget } = useDroppable({ id: `tag:${id}`, accept: 'image' });
  return <button ref={ref} className={`tag-bin${active ? ' active' : ''}${isDropTarget ? ' drop-target' : ''}`} aria-pressed={active} data-tag-id={id} onClick={onClick}>
    <span>{label}</span>{group && <small>{group}</small>}{active && <span className="applied-mark" aria-hidden="true">✓</span>}
  </button>;
}
export function TagBins({ project, tagIds, onToggle }: { project: ProjectConfig; tagIds: string[]; onToggle: (tagId: string) => void }) {
  const assigned = new Set(tagIds);
  return <aside className="tag-panel" aria-label="Tag categories">
    {project.groups.map((group) => <section key={group.id} className="tag-group" aria-label={group.label}>
      <h2>{group.label}{group.selection === 'one' ? <small>Choose one</small> : <small>Choose any</small>}</h2>
      <div className="tag-bins">{group.tags.map((tag) => <Bin key={tag.id} id={tag.id} label={tag.label} group={group.label} active={assigned.has(tag.id)} onClick={() => onToggle(tag.id)} />)}</div>
    </section>)}
    {project.booleanTags.length > 0 && <section className="tag-group"><h2>Independent tags</h2><div className="tag-bins">{project.booleanTags.map((tag) => <Bin key={tag.id} id={tag.id} label={tag.label} active={assigned.has(tag.id)} onClick={() => onToggle(tag.id)} />)}</div></section>}
  </aside>;
}
