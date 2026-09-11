# Take

Turn a raw screen recording into a polished product demo, directly in your browser.

Take is a local-first video editor built for product walkthroughs, launch clips, and social posts. Import a recording, frame it with a designed background, guide attention with smooth zooms and callouts, then export the finished video without uploading the source file.

## What it can do

- Import, preview, scrub, trim, split, and remove video clips
- Add smooth zooms, timed text callouts, and cursor treatments
- Detect areas of activity and create suggested focus moments
- Style the canvas with image backgrounds, colors, mockup frames, shadows, and spacing
- Apply dither and ASCII-inspired textures to the background without changing the recording
- Reposition and resize editing events directly on the timeline
- Preview in fullscreen and collapse the inspector for more working space
- Export at 720p, 1080p, 1440p, or 4K and 24, 30, or 60 fps
- Autosave projects and source video locally with IndexedDB
- Import and export portable project JSON files

## Local first

Your recording stays on your device. Editing and rendering happen in the browser, with no account or upload queue required.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To use another port:

```bash
npm run dev -- --port 3100
```

## Production build

```bash
npm run build
npm run start
```

## Browser support

Chrome and Edge provide the best experience. Export format and encoding support depend on the browser. Take uses MP4 when supported and falls back to WebM.

Exports render in real time. Keep the tab visible until the export finishes. Output frame delivery and quality depend on the source recording, browser encoder, and device performance.

## Built with

- React 19 and TypeScript
- Vinext and Vite
- GSAP
- Canvas and MediaRecorder APIs
- IndexedDB

## Current scope

Take includes a synthetic sample project so the editor can be explored before importing a recording. Imported recordings keep any cursor already captured in the source. Native screen recording, speech-to-caption transcription, and reconstructed click events are not included yet.
