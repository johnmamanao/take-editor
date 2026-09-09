# Take

## Visual polish

Exports now offer 720p, 1080p, 1440p and 2160p, 24/30/60 fps, and compact/high/maximum bitrate targets scaled to resolution and frame rate. Actual output quality/frame delivery depends on source, browser encoder, display scheduling and device performance; no frame interpolation is implemented.

Backgrounds support preset gradients, custom solid colors and PNG/JPG/WebP uploads (20 MB maximum). Images use centered cover cropping and are stored separately in IndexedDB; portable project JSON does not embed the background image. Reupload it on another device. Image cropping and bitmap cleanup have unit checks; live browser uploads and high-resolution exports still need hands-on verification.

Ordered dither and grain backgrounds render through the same cached canvas path in preview and export. Texture intensity and pixel size are project settings; older project files migrate automatically. Run `node scripts/check-textures.mjs` for deterministic rendering and migration checks.

GSAP handles the initial workspace entrance and brief pointer-initiated inspector changes. CSS handles press, hover, select, dialog, and toast feedback. Motion follows a shared easing system, skips keyboard-initiated panel transitions, and respects reduced-motion preferences. Paused previews redraw only when their contents change. Slider drags coalesce history entries.

A browser-based demo video editor. Run `npm install`, then `npm run dev`.

## Implemented

- Local video import, preview, playback, and scrubbing
- Background presets, aspect ratios, padding, corner radius, and shadow
- Editable zoom events with smooth entry/exit
- Timed text callouts
- Clip splitting, removal, trimming, and playback speed
- Undo/redo; project JSON import/export
- Device-local project autosave and video storage in IndexedDB
- Real-time canvas export with original audio, MP4 where supported and WebM fallback

The synthetic Orbit sample works without an uploaded file. Imported recordings retain their baked-in cursor. Cursor reconstruction, automated click capture, captions from speech, and a native recorder are not implemented.

## Validation

TypeScript and production build pass. Pure editing calculations checked for clip/speed mapping, output dimensions, camera easing, and invalid project inputs. Local route responds successfully. Browser interaction and a real exported-video playback have not been manually verified. Optional WebMCP registration is feature-detected; no compatible verification context was available.

Browser exports run in real time and require this tab to remain visible. Source videos and autosaved projects stay in this browser. Download a project file for a portable edit; it does not embed the source recording.
