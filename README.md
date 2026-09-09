# Take

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
