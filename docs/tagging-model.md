# Tagging model and provider boundary

## Project-neutral rules

The project file defines tag groups and independent boolean tags. A group chooses whether one or many of its values may be assigned. A single-choice replacement is an explicit action: Iris reports the removed value and the UI offers Undo. Undo restores the exact previous tag set, including conflicts that existed before the action. If stored data already contains multiple values in a one-choice group, Iris surfaces the conflict and does not change it until the user chooses a value in that group.

Tag IDs are stable machine identifiers. Labels are display text. Config validation rejects unknown schema versions, duplicate group/tag IDs, malformed cardinality, and malformed keyword mappings.

## Adapter boundary

| Concern | Shared interface | Local metadata adapter |
|---|---|---|
| Image identity | Opaque ID, filename, MIME type, writable status | Keeps absolute paths private and resolves IDs within the configured root |
| Tag state | Tag IDs and conflicted group IDs | Maps managed keywords to tag IDs |
| Preview | In-memory bytes | Uses sharp to resize/rotate and encode a preview |
| Assignment | Add/remove tag IDs | Reads and rewrites the configured ExifTool field, preserving unmanaged keywords |
| Storage details | No filesystem paths or metadata field names | Local-only configuration stores image root, metadata field, extensions, and keyword mapping |

A future provider implements `ImageProvider` without changing the UI or core tag rules. The local API validates requests and returns confirmed assignments only after the adapter reads them back.

## Failure behavior

- A failed metadata write returns an error and the browser keeps its last confirmed tag state.
- Unknown opaque image IDs do not resolve to filesystem paths.
- Paths are discovered under the configured root; symbolic links are skipped.
- Unsupported write formats are read-only.
- The browser receives no local root path or adapter settings.
