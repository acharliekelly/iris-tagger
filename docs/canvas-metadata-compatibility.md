# CANVAS metadata compatibility

## Status: probe pending

The implementation environment does not currently have the CANVAS vault mounted, representative image copies, or an ExifTool executable. No metadata field or writable format is asserted here. The project and adapter settings remain configurable until the probe is completed.

Before a first real write:

1. Make disposable copies of representative CANVAS files for each format in use.
2. Record their current metadata and dimensions/pixel hashes.
3. Use ExifTool read-only output to identify the exact subject/keyword field and its list representation.
4. Test that ExifTool can update that field on each copied format, retaining unrelated keywords and non-metadata image content.
5. Record the tested ExifTool version, field, formats, and test results below. Add only confirmed writable extensions to `configs/canvas.local.json`.
6. Keep the original vault untouched until fixture read, write, and re-read checks all pass.

### Read-only inspection

Run a version check and inspect metadata on copies before selecting a candidate field:

```sh
exiftool -ver
exiftool -G1 -a -s -Subject -Keywords /path/to/copy.jpg
```

Use ExifTool's group-qualified output to distinguish similarly named fields. Repeat for each representative format. Do not use the result from one file format as evidence for another.

For write verification, duplicate the files again, assign a temporary keyword through the candidate group-qualified field on the copies, then re-read them. Compare decoded image dimensions and pixel data before and after with a decoder such as sharp; embedded metadata writes normally change file bytes, so a whole-file hash is not a pixel-preservation test. Also confirm all unrelated subject/keyword values remain. Only then enter that field and those extensions in local configuration.

## Probe results

| Item | Result |
|---|---|
| ExifTool version | Pending |
| Embedded metadata field | Pending |
| Representative formats | Pending |
| Formats verified writable | Pending |
| Unmanaged keyword preservation | Pending |
| Pixel/content preservation | Pending |

The adapter uses the configured field and extension allowlist. Unsupported extensions can be displayed as read-only when they are a supported preview format; tag writes are rejected.
