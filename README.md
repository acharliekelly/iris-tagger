# Iris Image Tagger

Iris is a local-first image tagging interface. The first adapter targets CANVAS images in a mounted Cryptomator vault, storing managed tags as embedded keywords. The React interface and core tagging rules are independent of storage so future projects can provide another adapter, such as Cloudinary.

## Current CANVAS configuration

`configs/canvas.project.json` is a starter taxonomy using the concepts discussed so far: a multi-value Subject group, a one-value Location group, and the independent Shows face tag. Edit it to match the actual collection before tagging.

`configs/canvas.local.example.json` is a template. It intentionally has a placeholder image root and metadata field, and an empty writable-extension list. The sample is safe only after you fill in the mounted image root and the metadata field confirmed by the copy-first probe in [docs/canvas-metadata-compatibility.md](docs/canvas-metadata-compatibility.md). If you edit the project taxonomy, update `keywordByTagId` with one unique storage keyword for every tag ID. Keep writable extensions empty until each format passes the fixture write checks. `configs/canvas.local.json` is ignored by Git.

## Requirements

- Node.js 22 or newer
- ExifTool installed and available as `exiftool` on `PATH`
- A mounted Cryptomator vault, plus disposable image copies for compatibility checks

## Local development

```sh
npm install
cp configs/canvas.local.example.json configs/canvas.local.json
# Edit configs/canvas.local.json after the compatibility probe
npm run dev
```

The API listens on `127.0.0.1:4174`; Vite serves the UI on `127.0.0.1:5173` and proxies API requests. The project will not write to image formats missing from `writableExtensions`.

## Production build

```sh
npm run build
npm run api
```

The API serves the built UI and JSON routes from the same local origin. The API only binds to loopback. Preview responses use `Cache-Control: no-store`; thumbnails are generated in memory and never written to disk.

## Verification

```sh
npm test -- --run
npm run typecheck
npm run build
```

Automated adapter/API integration tests use isolated temporary images and an injected metadata store. The real CANVAS ExifTool field and writable file formats remain unverified until representative copies and ExifTool are available; complete the documented probe before pointing Iris at the source collection.
