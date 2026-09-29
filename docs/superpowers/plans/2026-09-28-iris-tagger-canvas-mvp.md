# Iris Image Tagger — CANVAS MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local React image-tagging app that applies project-configured tags to CANVAS images and writes managed keywords into embedded metadata.

**Architecture:** A React/Vite frontend communicates with a local Node API. The API uses shared TypeScript contracts and project configuration, then delegates filesystem and metadata operations to a CANVAS adapter. The adapter contract is designed so a future Cloudinary implementation can be added without changing the interface or tagging rules.

**Tech Stack:** TypeScript, React, Vite, Node.js, Fastify, Zod, ExifTool, sharp, Vitest, React Testing Library, and [@dnd-kit/react](https://dndkit.com/react/quickstart/). Use npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-28-iris-tagger-design.md`

## Global Constraints

- Bind the local API to loopback only; serve the production frontend and API from the same local origin.
- Restrict all filesystem operations to the configured image root.
- Use strict origin checks on API mutations; do not enable open CORS.
- Do not persist preview thumbnails outside the image root; preview responses use `Cache-Control: no-store`.
- Preserve keywords Iris does not manage.
- Never silently resolve pre-existing conflicts in single-choice groups.
- Verify metadata edits against image copies before using the real CANVAS collection.
- Keep project tag rules separate from adapter configuration. The project/API contract must not contain local filesystem paths or metadata field names.
- The metadata field and supported write formats must come from the compatibility probe in Task 2, not from a guessed ExifTool field name.

## Review Focus

- A malformed or internally inconsistent project config must fail at startup with actionable validation details. (Task 1 tests.)
- A path traversal, symlink escape, or image outside the configured root must not be listed, previewed, or modified. (Task 2 adapter tests.)
- Unknown keywords and unrelated metadata must survive a tag update. (Task 2 adapter tests.)
- An unmounted vault, disappearing file, unsupported format, or failed ExifTool invocation must produce a failure while retaining the last confirmed UI state. (Tasks 2–4 tests.)
- Pre-existing multiple values in a single-choice group must be surfaced for explicit repair; applying another tag must not silently normalize them. (Tasks 1 and 4 tests.)

---

## File map

- Repository root: `iris-tagger/`, kept separate from the earlier Iris image-search project.
- `package.json`, `package-lock.json`: npm workspace and root scripts.
- `tsconfig.base.json`: shared TypeScript settings.
- `apps/web/`: Vite entry point, React screen, gallery, tag bins, and API client.
- `apps/local-api/`: Fastify startup, routes, request validation, and local security.
- `packages/core/`: shared image/tag types and pure tag transition functions.
- `packages/config/`: Zod schemas and JSON loading for project rules and adapter settings.
- `packages/adapters/local-metadata/`: bounded filesystem discovery, previews, keyword mapping, and ExifTool operations.
- `configs/canvas.project.json`: project-neutral CANVAS tags and groups.
- `configs/canvas.local.example.json`: placeholder adapter settings for documentation.
- Runtime only: `configs/canvas.local.json` (gitignored; contains the user's mounted imageRoot).
- `docs/canvas-metadata-compatibility.md`: verified metadata field and supported read/write format matrix.
- Each package owns colocated `src/` and `test/` directories; UI tests live beside components.

## Task 1: Workspace scaffold and configuration model

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.workspace.ts`
- Create: `packages/core/src/types.ts`, `packages/core/src/tag-transitions.ts`
- Create: `packages/config/src/schema.ts`, `packages/config/src/load-config.ts`
- Create: `packages/core/test/tag-transitions.test.ts`, `packages/config/test/schema.test.ts`
- Create: `configs/canvas.project.json`, `configs/canvas.local.example.json`, `.gitignore`
- Runtime only: `configs/canvas.local.json` (gitignored; actual local adapter settings).

**Interfaces:**
- `TagDefinition = { id: string; label: string }`
- `TagGroup = { id: string; label: string; selection: "one" | "many"; tags: TagDefinition[] }`
- `BooleanTag = { id: string; label: string }`
- `ProjectConfig = { schemaVersion: 1; id: string; name: string; groups: TagGroup[]; booleanTags: BooleanTag[] }`
- `ImageRecord = { id: string; fileName: string; mimeType: string; writable: boolean; readOnlyReason?: string }`; local paths remain private to the adapter.
- `ImageWithTags = { image: ImageRecord; tagIds: string[]; conflictedGroupIds: string[] }`
- `TagMutation = { add?: string[]; remove?: string[]; restore?: string[] }`
- `TagUpdateResult = { tagIds: string[]; replacedTagIds: string[]; conflictedGroupIds: string[] }`
- `ImageProvider = { listImages(): Promise<ImageWithTags[]>; getPreview(imageId: string): Promise<Uint8Array>; updateTags(imageId: string, mutation: TagMutation): Promise<TagUpdateResult> }`
- `LocalMetadataConfig = { schemaVersion: 1; adapter: "local-metadata"; imageRoot: string; metadataField: string; writableExtensions: string[]; keywordByTagId: Record<string, string> }`
- `applyTag(current: string[], tagId: string, config: ProjectConfig): { next: string[]; replaced: string[] }`
- `removeTag(current: string[], tagId: string): string[]`
- `validateProjectConfig(input: unknown): ProjectConfig`
- `validateLocalMetadataConfig(input: unknown, project: ProjectConfig): LocalMetadataConfig`

- [x] **Step 1: Initialize the new `iris-tagger` Git repository, create the npm workspace, configure Vitest, and add root scripts and `.gitignore`.** Keep `configs/canvas.local.json` ignored.
- [x] **Step 2: Write failing tests** for one-choice replacement, many-choice coexistence, independent boolean add/remove, explicit resolution of an existing same-group conflict, unknown tag IDs, duplicate tag IDs, invalid group cardinality, and unknown project schema version. Also test local-adapter config for incomplete/extra tag mappings, duplicate keyword mappings, unsupported schema version, and non-absolute image roots.
- [ ] **Step 3: Run `npm test -- --run`; confirm the new behavior tests fail.** (Not observed before implementation; final suite is green.)
- [x] **Step 4: Implement shared types, project and local-adapter Zod validation, and pure tag transition functions.** Replacing multiple existing values in a single-choice group is allowed only when the user explicitly adds a chosen value from that same group.
- [x] **Step 5: Add tracked `canvas.project.json` and placeholder `canvas.local.example.json`; document how the user creates `canvas.local.json` with the mounted path.**
- [x] **Step 6: Run `npm test -- --run` and confirm all core/config tests pass.**
- [x] **Step 7: Commit as `feat: establish Iris workspace and tagging model`.**

## Task 2: CANVAS metadata compatibility and adapter

**Files:**
- Create: `packages/adapters/local-metadata/src/metadata-store.ts`
- Create: `packages/adapters/local-metadata/src/filesystem-image-source.ts`
- Create: `packages/adapters/local-metadata/src/exiftool-keyword-store.ts`
- Create: `packages/adapters/local-metadata/src/canvas-image-provider.ts`
- Create: `packages/adapters/local-metadata/test/metadata-store.test.ts`
- Create: `packages/adapters/local-metadata/test/filesystem-image-source.test.ts`
- Create: `docs/canvas-metadata-compatibility.md`

**Interfaces:**
- `ImageRecord = { id: string; fileName: string; mimeType: string; writable: boolean; readOnlyReason?: string }`; local paths remain private to the adapter.
- `ImageWithTags = { image: ImageRecord; tagIds: string[]; conflictedGroupIds: string[] }`
- `TagMutation = { add?: string[]; remove?: string[]; restore?: string[] }`
- `ImageProvider = { listImages(): Promise<ImageWithTags[]>; getPreview(imageId: string): Promise<Uint8Array>; updateTags(imageId: string, mutation: TagMutation): Promise<TagUpdateResult> }`
- `CanvasImageProvider implements ImageProvider`; internal metadata operations preserve keywords not mapped by `keywordByTagId`.

- [x] **Step 1: Write failing adapter tests** using temporary image copies: list only supported files below imageRoot, reject path traversal and symlink escapes, read current tag IDs, update managed keywords while preserving unknown keywords, handle absent keyword metadata, and surface write failures.
- [ ] **Step 2: Run `npm test -- --run packages/adapters/local-metadata`; confirm the expected tests fail.** (Not observed before implementation; final adapter suite is green.)
- [ ] **Step 3: Perform a read-only compatibility probe** on representative copies from the user’s CANVAS formats using ExifTool. Record the actual subject/keyword field and which formats permit safe embedded writes in `docs/canvas-metadata-compatibility.md`; update the local-adapter config sample to that verified field. (Pending: the implementation environment has no mounted CANVAS copies or ExifTool executable.)
- [x] **Step 4: Implement `CanvasImageProvider` with image discovery constrained to imageRoot and metadata read/write through ExifTool.** Keep local paths inside the adapter, invoke ExifTool without a shell, use the configured (probe-pending) field and `keywordByTagId` mapping, update only managed keywords after reading current metadata, then re-read the file and return confirmed assignments.
- [x] **Step 5: Implement in-memory preview generation with no persistent thumbnail cache.**
- [ ] **Step 6: Run adapter tests against fixture copies and verify a write changes keywords while preserving unrelated keywords and image pixels.** (Pending on the real ExifTool compatibility probe; automated tests currently use an injected metadata store.)
- [x] **Step 7: Commit as `feat: add CANVAS image metadata adapter`.**

## Task 3: Local API

**Files:**
- Create: `apps/local-api/src/server.ts`
- Create: `apps/local-api/src/routes/project.ts`
- Create: `apps/local-api/src/routes/images.ts`
- Create: `apps/local-api/src/security.ts`
- Create: `apps/local-api/test/images-routes.test.ts`, `apps/local-api/test/security.test.ts`

**Interfaces:**
- `GET /api/project` returns validated project config without local secrets.
- `GET /api/images` returns image records and current managed tags.
- `GET /api/images/:imageId/preview` returns a no-store preview.
- `PUT /api/images/:imageId/tags` accepts `TagMutation` and returns confirmed resulting assignments plus any replaced tag IDs.
- `createServer(config: ProjectConfig, provider: ImageProvider): FastifyInstance`

- [ ] **Step 1: Write failing route tests** for project config without adapter paths, list/preview/update, one-choice replacement, malformed payload, unsupported image, multiple values added to the same single-choice group in one request, and adapter write failure. (Tests exist; red behavior run was not observed before implementation.)
- [x] **Step 2: Add tests proving unknown opaque image IDs cannot access files and cross-origin mutations fail.** Path traversal and symlink escape belong to the adapter tests in Task 2.
- [ ] **Step 3: Run `npm test -- --run apps/local-api`; confirm tests fail before implementation.** (Not observed before implementation; final API suite is green.)
- [x] **Step 4: Implement Fastify routes using shared project rules and the generic `ImageProvider` contract; never return local adapter config or absolute imageRoot to the browser.**
- [x] **Step 5: Bind startup to `127.0.0.1`, validate Host/Origin for mutations, proxy `/api` through Vite in development, serve the production web build from the API origin, and return previews with `Cache-Control: no-store`.**
- [x] **Step 6: Run local API tests and confirm API errors never return updated assignments after failed writes.**
- [x] **Step 7: Commit as `feat: add loopback image tagging API`.**

## Task 4: React tagging interface

**Files:**
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/components/ImageGrid.tsx`
- Create: `apps/web/src/components/TagBins.tsx`
- Create: `apps/web/src/components/TaggingWorkspace.tsx`
- Create: component tests under `apps/web/src/components/*.test.tsx`

**Interfaces:**
- `fetchProject(): Promise<ProjectConfig>`
- `fetchImages(): Promise<ImageWithTags[]>`
- `updateImageTags(imageId: string, change: TagMutation): Promise<TagUpdateResult>`

- [x] **Step 1: Write failing component tests** for selection/highlighting, drag-to-bin, click-to-apply, removal, replacement with Undo, and visible pre-existing conflicts.
- [x] **Step 2: Run `npm test -- --run apps/web`; confirm the new tests fail.**
- [x] **Step 3: Implement the API client and React workspace using `@dnd-kit/react`; after a drop, show pending state and only update confirmed tag state after API success.**
- [x] **Step 4: Implement click-based add/remove actions and Undo for single-choice replacement.**
- [x] **Step 5: Show API/write errors without changing the last confirmed assignments; show unsupported files as read-only.**
- [x] **Step 6: Run component tests and `npm run build`; confirm they pass.**
- [x] **Step 7: Commit as `feat: build CANVAS image tagging interface`.**

## Task 5: End-to-end verification and run instructions

**Files:**
- Create: `apps/local-api/test/canvas-e2e.test.ts`
- Create: `README.md`
- Modify: root workspace scripts as needed.

- [x] **Step 1: Add an end-to-end integration test** with a generated temporary raster, CANVAS project config, and injected metadata store; verify list/preview/tagging, unmanaged-keyword retention, and unchanged pixels. Real embedded metadata verification remains pending on the compatibility probe.
- [x] **Step 2: Test a failed write and an unmounted/unavailable image root; verify API errors and that the UI retains its previous confirmed state.**
- [x] **Step 3: Run `npm test -- --run` and `npm run build`; confirm all tests and the production build pass.**
- [x] **Step 4: Document install/start commands, ExifTool requirement, imageRoot configuration, the pending supported-format matrix, and the copy-first validation workflow.**
- [x] **Step 5: Commit as `docs: document CANVAS MVP setup and verification`.**

## Execution notes

- Task 2 requires representative CANVAS image copies available to the implementer. If they are not available in the implementation workspace, pause metadata writes and finish only the read-only probe with user-provided samples.
- Do not implement Cloudinary in this plan. Verify that the shared interfaces do not mention local paths or ExifTool; that boundary is the extension point for a later Cloudinary adapter.
