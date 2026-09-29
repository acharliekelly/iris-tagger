# Iris Image Tagger Design

Date: 2026-09-28

## Purpose

This Iris image-tagging project is distinct from the earlier Iris image-search visualization. It is a reusable React tool for assigning project-specific tags to image collections. Its first end-to-end use is CANVAS: images in a mounted Cryptomator vault, with tags stored as embedded subject keywords. The design should allow a later Cloudinary adapter without rebuilding the interface or tagging model.

## Tagging model

Use two kinds of tags:

- **Independent tags** are present or absent, such as `ShowsFace`.
- **Choice groups** contain named values and define whether one or many values may apply. For example, `Location` may allow only one value (`Boston` or `Maine`), while an `ArtSubject` group may allow both `People` and `Landscape`.

This adapts the useful distinction between inclusive tags and exclusive classifications in React Image Annotate, while fitting Iris’s category-bin workflow rather than image-drawing annotation.

A versioned JSON project configuration defines groups, values, labels, and selection rules. Adapter-specific configuration separately defines where images live and how each tag is represented in that storage system. The API combines these configurations, while the React interface receives only the project-neutral tag rules and image data. This keeps local paths and metadata field names out of the UI contract.

## Project structure

```text
iris-tagger/
  apps/
    web/                  # React interface
    local-api/            # Local service for images and metadata
  packages/
    core/                 # Shared image and tagging contracts
    config/               # Project and adapter config schemas
    adapters/
      local-metadata/     # CANVAS filesystem and keyword adapter
  configs/
    canvas.project.json   # project-neutral tags and group rules
    canvas.local.example.json # placeholder local adapter settings
    canvas.local.json     # user-specific, gitignored adapter settings
  docs/
```

The web app calls the local API through shared contracts. The API delegates storage work to the selected adapter. CANVAS is the first adapter; Cloudinary can later implement the same operations.

## CANVAS MVP

The interface has project-configured tag bins and a browsable image grid. Selecting an image highlights its current tags. Dragging the image to a bin adds that tag; clicking a bin while the image is selected provides the same action without dragging. Clicking an applied tag removes it.

For a single-choice group, applying another value replaces the current value. Show the replacement clearly and provide Undo. If an image already has conflicting values in a single-choice group, surface that state; the user's explicit selection of a value in that group resolves the conflict.

The MVP is complete when Iris can:

- Load and validate CANVAS configuration.
- Browse supported images under a configured local root and show previews.
- Read and display managed keywords as tags.
- Add and remove tags, enforcing configured group rules.
- Save updates as embedded keywords while preserving unmanaged keywords.
- Report failures clearly and retain the last confirmed state in the UI.

Bulk tagging, automatic tag suggestions, multi-user support, and Cloudinary integration are out of scope for the MVP.

## API and adapter boundary

The React app works with shared image and tag data. It asks the API to list images, retrieve previews and current tags, and apply tag changes. It does not access local files or manipulate metadata itself.

The CANVAS adapter owns filesystem access and keyword reads and writes. Its adapter configuration maps Iris tag IDs to flat stored keywords, identifies the metadata field, and sets the image root. The project-neutral tag configuration contains no file paths or metadata field names. A later Cloudinary adapter can map the same tag IDs to Cloudinary metadata through its own configuration.

The local API listens only on the local machine, validates that requested paths remain under the configured image root, and uses strict origin protections. If the Cryptomator vault is unmounted or a metadata write fails, the API returns an error without claiming the update succeeded.

Because CANVAS images may be sensitive, previews are not persistently cached outside the vault. Generate or serve them without leaving unencrypted thumbnail files behind.

## Verification

Before applying changes to the real collection, test against image copies. Verify configuration validation, one-value and many-value rules, keyword mapping, preservation of unmanaged keywords, and failed writes. Confirm which file formats and metadata fields can be safely updated; unsupported files are read-only.
