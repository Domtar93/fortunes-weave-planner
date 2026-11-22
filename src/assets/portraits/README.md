# Character portraits

The bundled portraits are official art © Nintendo / Intelligent Systems, downloaded on
November 21, 2026 from the Fire Emblem Wiki (`<Name>FE18Portrait.png`, 400px thumbnails),
cropped to the head and shoulders and saved as 256px WebP. Eshmel has no standard portrait.

Put one image per character in this folder and the planner shows it in the unit card, the
character reference and the "Current build" bar. Characters without an image show their
initials instead, so you can add pictures a few at a time.

## Naming

Use the character's name in lower case, with spaces replaced by hyphens and any part in
brackets dropped:

| Character | File name |
|---|---|
| Alexandra | `alexandra.webp` |
| Hong Hua | `hong-hua.png` |
| Mu and Mu (with growth) | `mu.jpg` (shared) |

Accepted formats: `.webp`, `.png`, `.jpg`, `.jpeg`, `.avif`.

## Image guidelines

- Square, face and shoulders centred, at least 256 × 256 px. The picture is cropped to a
  hexagon, so keep the face away from the corners.
- Keep each file under about 60 KB (WebP at quality 80 works well) so the page stays fast.
- Only add images you have the right to publish. Official game art belongs to its owners.

Restart `pnpm dev` after adding new files so Vite picks them up.
