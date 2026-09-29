import { useEffect, useState } from 'react';
import type { ProjectConfig } from '../../../packages/core/src/types.js';
import { fetchProject } from './api/client.js';
import { TaggingWorkspace } from './components/TaggingWorkspace.js';
export default function App() {
  const [project, setProject] = useState<ProjectConfig>();
  const [error, setError] = useState('');
  useEffect(() => { void fetchProject().then(setProject).catch(() => setError('Unable to load project configuration. Check the local API and configuration files.')); }, []);
  if (error) return <main className="startup-error" role="alert">{error}</main>;
  if (!project) return <main className="startup-error">Loading Iris…</main>;
  return <TaggingWorkspace project={project} />;
}
