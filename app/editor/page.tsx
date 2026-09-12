'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useStudioMotion } from '@/hooks/use-studio-motion';
import { LogoMark } from '@/components/logo-mark';
import {
  setBackgroundImage,
  asciiCharacterSets,
  type AsciiCharacters,
  type Texture,
} from '@/lib/background';
import { frameLayout } from '@/lib/frames';
import {
  Film,
  Upload,
  ArrowUpRight,
  Layers,
  Sparkles,
  MousePointer2,
  Type,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Plus,
  ZoomIn,
  ZoomOut,
  Check,
  Scissors,
  Undo2,
  Redo2,
  Monitor,
  Volume2,
  VolumeX,
  Trash2,
  Download,
  FolderOpen,
  RotateCcw,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  initialProject,
  themes,
  uid,
  clamp,
  duration,
  sourceTime,
  size,
  formatTime,
  renderFrame,
  validateProject,
  type Project,
  type Zoom,
} from '@/lib/editor';
import { storeVideo, restoreVideo, backgroundFile } from '@/lib/storage';

function Range({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="setting">
      <div>
        <label>{label}</label>
        <span>
          {Number(value.toFixed(2))}
          {unit}
        </span>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </div>
  );
}
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger aria-label={label} className="choice">
        <SelectValue>{options.find((o) => o[0] === value)?.[1]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem value={v} key={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function seekVideoFrame(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.02 && video.readyState >= 2)
    return;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('A frame took too long to analyze.')),
      5000,
    );
    video.addEventListener(
      'seeked',
      () => {
        window.clearTimeout(timer);
        requestAnimationFrame(() => resolve());
      },
      { once: true },
    );
    video.currentTime = time;
  });
}

async function findActivityZooms(
  video: HTMLVideoElement,
  project: Project,
): Promise<Zoom[]> {
  const width = 160,
    height = 100,
    columns = 8,
    rows = 5,
    canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Frame analysis is unavailable.');
  const projectDuration = duration(project);
  if (!Number.isFinite(projectDuration) || projectDuration < 1)
    throw new Error('This recording is too short to analyze.');
  const previousTime = video.currentTime;
  const sampleCount = Math.min(10, Math.max(4, Math.ceil(projectDuration / 4)));
  const samples = Array.from(
    { length: sampleCount },
    (_, index) =>
      0.6 + ((projectDuration - 1.2) * (index + 1)) / (sampleCount + 1),
  );
  const candidates: Array<{
    time: number;
    x: number;
    y: number;
    score: number;
  }> = [];
  try {
    for (const sampleTime of samples) {
      await seekVideoFrame(
        video,
        sourceTime(project, Math.max(0, sampleTime - 0.28)),
      );
      context.drawImage(video, 0, 0, width, height);
      const before = context.getImageData(0, 0, width, height).data;
      await seekVideoFrame(video, sourceTime(project, sampleTime));
      context.drawImage(video, 0, 0, width, height);
      const after = context.getImageData(0, 0, width, height).data;
      const scores = new Float32Array(columns * rows);
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const pixel = (y * width + x) * 4;
          const difference =
            Math.abs(after[pixel] - before[pixel]) +
            Math.abs(after[pixel + 1] - before[pixel + 1]) +
            Math.abs(after[pixel + 2] - before[pixel + 2]);
          const cell =
            Math.min(rows - 1, Math.floor((y / height) * rows)) * columns +
            Math.min(columns - 1, Math.floor((x / width) * columns));
          scores[cell] += difference;
        }
      }
      let strongest = 0;
      for (let index = 1; index < scores.length; index++)
        if (scores[index] > scores[strongest]) strongest = index;
      candidates.push({
        time: sampleTime,
        x: ((strongest % columns) + 0.5) / columns,
        y: (Math.floor(strongest / columns) + 0.5) / rows,
        score: scores[strongest],
      });
    }
  } finally {
    await seekVideoFrame(video, Math.min(previousTime, video.duration));
  }
  const chosen: typeof candidates = [];
  const strongestScore = Math.max(...candidates.map((item) => item.score));
  const ranked = candidates
    .filter((item) => item.score >= Math.max(800, strongestScore * 0.18))
    .sort((a, b) => b.score - a.score);
  for (const candidate of ranked) {
    if (chosen.every((item) => Math.abs(item.time - candidate.time) > 3.4))
      chosen.push(candidate);
    if (chosen.length === Math.min(3, Math.ceil(projectDuration / 7))) break;
  }
  return chosen
    .sort((a, b) => a.time - b.time)
    .map((candidate) => {
      const start = clamp(
        candidate.time - 0.7,
        0,
        Math.max(0, projectDuration - 2.8),
      );
      return {
        id: uid(),
        start,
        duration: Math.min(2.8, projectDuration - start),
        scale: 1.28,
        x: clamp(candidate.x, 0.18, 0.82),
        y: clamp(candidate.y, 0.18, 0.82),
      };
    });
}

export default function Home() {
  const root = useRef<HTMLElement>(null);
  const [p, setP] = useState<Project>(initialProject),
    [tab, setTab] = useState('Canvas'),
    [inspectorOpen, setInspectorOpen] = useState(true),
    [fullscreen, setFullscreen] = useState(false),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [videoUrl, setVideoUrl] = useState(''),
    [fileName, setFileName] = useState('Orbit · Product walkthrough'),
    [selected, setSelected] = useState('z1'),
    [selectedClip, setSelectedClip] = useState('c1'),
    [notice, setNotice] = useState(''),
    [saveStatus, setSaveStatus] = useState('Saved on this device'),
    [ready, setReady] = useState(false),
    [exportOpen, setExportOpen] = useState(false),
    [exporting, setExporting] = useState(false),
    [progress, setProgress] = useState(0),
    [quality, setQuality] = useState('source'),
    [fps, setFps] = useState('30'),
    [bitrateSetting, setBitrateSetting] = useState('auto'),
    [encodingQuality, setEncodingQuality] = useState('high'),
    [backgroundName, setBackgroundName] = useState(''),
    [history, setHistory] = useState<Project[]>([]),
    [future, setFuture] = useState<Project[]>([]),
    [dragging, setDragging] = useState(false),
    [loading, setLoading] = useState(false),
    [analyzing, setAnalyzing] = useState(false),
    [timelineScale, setTimelineScale] = useState(1),
    [sourceId, setSourceId] = useState('sample'),
    [missingSource, setMissingSource] = useState(false),
    [sourceHeight, setSourceHeight] = useState(1080),
    [webCodecsAvailable, setWebCodecsAvailable] = useState(false);
  useStudioMotion(root, tab);
  const canvas = useRef<HTMLCanvasElement>(null),
    video = useRef<HTMLVideoElement>(null),
    stage = useRef<HTMLElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    backgroundInput = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null),
    live = useRef({ p, time, playing }),
    cancel = useRef(false),
    audio = useRef<{
      context: AudioContext;
      source: MediaElementAudioSourceNode;
    } | null>(null),
    sourceDuration = useRef(24),
    sourceFile = useRef<Blob | null>(null),
    urlRef = useRef('');
  const zoomDrag = useRef<{
    id: string;
    pointerId: number;
    mode: 'move' | 'start' | 'end';
    startX: number;
    start: number;
    duration: number;
    trackWidth: number;
    moved: boolean;
  } | null>(null);
  const clipDrag = useRef<{
    id: string;
    pointerId: number;
    edge: 'start' | 'end';
    startX: number;
    start: number;
    end: number;
    trackWidth: number;
    visibleDuration: number;
  } | null>(null);
  const captionDrag = useRef<{
    id: string;
    pointerId: number;
    mode: 'move' | 'start' | 'end';
    startX: number;
    start: number;
    duration: number;
    trackWidth: number;
  } | null>(null);
  const suppressZoomClick = useRef(false);
  const suppressCaptionClick = useRef(false);
  const suppressClipClick = useRef(false);
  live.current.p = p;
  live.current.playing = playing;
  if (!playing) live.current.time = time;

  const total = duration(p),
    zoom = p.zooms.find((z) => z.id === selected),
    caption = p.captions.find((c) => c.id === selected),
    clip = p.clips.find((c) => c.id === selectedClip);
  const [W, H] = size(p.ratio, 720);
  const exportQuality =
    quality === 'source'
      ? clamp(sourceHeight || 1080, 360, 2160)
      : Number(quality);
  const effectiveExportFps = webCodecsAvailable
    ? Number(fps)
    : Math.min(Number(fps), 30);
  const automaticBitrate = Math.round(
    8000000 *
      (exportQuality / 1080) ** 2 *
      (effectiveExportFps / 30) *
      (encodingQuality === 'maximum'
        ? 1.5
        : encodingQuality === 'compact'
          ? 0.6
          : 1),
  );
  const bitrate =
    bitrateSetting === 'auto'
      ? automaticBitrate
      : Number(bitrateSetting) * 1_000_000;
  const inform = useCallback((s: string) => setNotice(s), []);

  useEffect(() => {
    setWebCodecsAvailable(typeof VideoEncoder !== 'undefined');
  }, []);

  useEffect(() => {
    const syncFullscreen = () =>
      setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () =>
      document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current?.requestFullscreen();
    } catch {
      inform('Fullscreen is not available in this browser.');
    }
  }, [inform]);
  useEffect(() => {
    let active = true;
    backgroundFile()
      .then(async (file) => {
        if (!file || !active) return;
        await setBackgroundImage(file);
        if (active) {
          setBackgroundName(file.name);
          setP((old) => ({ ...old }));
        }
      })
      .catch(() =>
        inform('Background image could not be restored. Upload it again.'),
      );
    return () => {
      active = false;
    };
  }, [inform]);
  async function uploadBackground(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      inform('Choose a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      inform('Choose a background smaller than 20 MB.');
      return;
    }
    try {
      await setBackgroundImage(file);
      setBackgroundName(file.name);
      update({ backgroundMode: 'image' });
      try {
        await backgroundFile(file);
        inform('Background image saved on this device.');
      } catch {
        inform('Image loaded, but could not be saved. Keep this tab open.');
      }
    } catch {
      inform('That image could not be opened. Try another PNG, JPG, or WebP.');
    }
  }
  const lastEdit = useRef({ key: '', at: 0 });
  const update = useCallback((patch: Partial<Project>) => {
    const old = live.current.p,
      key = Object.keys(patch).sort().join(','),
      now = performance.now();
    if (key !== lastEdit.current.key || now - lastEdit.current.at > 450)
      setHistory((h) => [...h.slice(-49), old]);
    lastEdit.current = { key, at: now };
    setFuture([]);
    setSaveStatus('Saving…');
    const next = { ...old, ...patch };
    live.current.p = next;
    setP(next);
  }, []);
  const undo = () => {
    if (!history.length) return;
    lastEdit.current = { key: '', at: 0 };
    setFuture((f) => [p, ...f]);
    setP(history.at(-1)!);
    setHistory((h) => h.slice(0, -1));
    setPlaying(false);
  };
  const redo = () => {
    if (!future.length) return;
    lastEdit.current = { key: '', at: 0 };
    setHistory((h) => [...h, p]);
    setP(future[0]);
    setFuture((f) => f.slice(1));
    setPlaying(false);
  };
  const seek = useCallback((t: number) => {
    const next = clamp(t, 0, duration(live.current.p));
    live.current.time = next;
    setTime(next);
  }, []);
  const addZoom = () => {
    const at = Math.min(time, Math.max(0, total - 1)),
      z = {
        id: uid(),
        start: at,
        duration: Math.min(3, total - at),
        scale: 1.28,
        x: 0.5,
        y: 0.5,
      };
    update({ zooms: [...p.zooms, z] });
    setSelected(z.id);
    setTab('Zoom');
    setPlaying(false);
    inform('Zoom added. Click the preview to set its focus.');
  };
  const autoFocus = async () => {
    setPlaying(false);
    setAnalyzing(true);
    try {
      const next =
        videoUrl && video.current
          ? await findActivityZooms(video.current, p)
          : [
              {
                id: uid(),
                start: 3.4,
                duration: 2.8,
                scale: 1.28,
                x: 0.32,
                y: 0.65,
              },
              {
                id: uid(),
                start: 10.7,
                duration: 2.8,
                scale: 1.28,
                x: 0.82,
                y: 0.65,
              },
              {
                id: uid(),
                start: 16.1,
                duration: 2.8,
                scale: 1.28,
                x: 0.43,
                y: 0.32,
              },
            ].filter((item) => item.start < total - 0.2);
      if (!next.length) throw new Error('No clear activity was found.');
      update({ zooms: next });
      setSelected(next[0].id);
      setTab('Zoom');
      seek(next[0].start + Math.min(0.7, next[0].duration / 2));
      inform(
        `${next.length} focus ${next.length === 1 ? 'moment' : 'moments'} added. Review them on the timeline.`,
      );
    } catch (error) {
      inform(`Auto focus could not finish: ${(error as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  };
  const editZoom = (patch: Partial<Zoom>) =>
    zoom &&
    update({
      zooms: p.zooms.map((z) => (z.id === zoom.id ? { ...z, ...patch } : z)),
    });
  const removeZoom = (id = selected) => {
    const current = live.current.p;
    if (!id || !current.zooms.some((z) => z.id === id)) return;
    update({ zooms: current.zooms.filter((z) => z.id !== id) });
    setSelected('');
    setPlaying(false);
    inform('Zoom removed.');
  };
  const removeClip = (id = selectedClip) => {
    const current = live.current.p;
    if (!id || !current.clips.some((c) => c.id === id)) return;
    if (current.clips.length === 1) {
      inform('Keep at least one clip in the timeline.');
      return;
    }
    const clips = current.clips.filter((c) => c.id !== id);
    update({ clips });
    setSelectedClip(clips[0].id);
    setPlaying(false);
    seek(0);
    inform('Clip deleted.');
  };
  const startClipTrim = (
    event: ReactPointerEvent<HTMLSpanElement>,
    target: Project['clips'][number],
    edge: 'start' | 'end',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const track = event.currentTarget.closest('.clips-row');
    if (!(track instanceof HTMLElement)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    clipDrag.current = {
      id: target.id,
      pointerId: event.pointerId,
      edge,
      startX: event.clientX,
      start: target.start,
      end: target.end,
      trackWidth: track.getBoundingClientRect().width,
      visibleDuration: p.clips.reduce(
        (sum, item) => sum + item.end - item.start,
        0,
      ),
    };
    suppressClipClick.current = true;
    setSelectedClip(target.id);
    setTab('Clip');
    setPlaying(false);
  };
  const moveClipTrim = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const drag = clipDrag.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.trackWidth <= 0)
      return;
    const delta =
      ((event.clientX - drag.startX) / drag.trackWidth) * drag.visibleDuration;
    const current = live.current.p;
    update({
      clips: current.clips.map((item) => {
        if (item.id !== drag.id) return item;
        return drag.edge === 'start'
          ? { ...item, start: clamp(drag.start + delta, 0, drag.end - 0.1) }
          : {
              ...item,
              end: clamp(
                drag.end + delta,
                drag.start + 0.1,
                sourceDuration.current,
              ),
            };
      }),
    });
  };
  const addText = () => {
    const at = Math.min(time, Math.max(0, total - 1)),
      c = {
        id: uid(),
        start: at,
        duration: Math.min(4, total - at),
        text: 'Your next great idea, in motion.',
      };
    update({ captions: [...p.captions, c] });
    setSelected(c.id);
    setTab('Text');
  };
  const removeCaption = (id = selected) => {
    const current = live.current.p;
    if (!id || !current.captions.some((item) => item.id === id)) return;
    update({ captions: current.captions.filter((item) => item.id !== id) });
    setSelected('');
    inform('Callout removed.');
  };
  const split = () => {
    let at = time * p.speed;
    const clips = [...p.clips];
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i],
        len = c.end - c.start;
      if (at < len) {
        if (at < 0.1 || len - at < 0.1) {
          inform('Move the playhead inside a clip to split it.');
          return;
        }
        const next = { id: uid(), start: c.start + at, end: c.end };
        clips.splice(i, 1, { ...c, end: c.start + at }, next);
        update({ clips });
        setSelectedClip(next.id);
        setTab('Clip');
        inform('Clip split. Select either segment to trim or remove it.');
        return;
      }
      at -= len;
    }
  };
  const toggle = () => {
    if (time >= total - 0.02) setTime(0);
    setPlaying((v) => !v);
  };
  useEffect(() => {
    let stopped = false;
    const saved = localStorage.getItem('take-project-v2');
    const legacy = !saved ? localStorage.getItem('take-project-v1') : null;
    let expectedSource = 'sample';
    if (saved || legacy) {
      try {
        const parsed = JSON.parse(saved || legacy!);
        const project = saved ? parsed.project : parsed;
        expectedSource = saved ? String(parsed.sourceId || 'sample') : 'legacy';
        setSourceId(expectedSource);
        setP(validateProject(project));
      } catch {
        inform(
          'The previous project could not be restored. A sample is ready.',
        );
      }
    }
    restoreVideo()
      .then((stored) => {
        if (stopped) return;
        const matches =
          stored &&
          (expectedSource === 'legacy' ||
            (expectedSource !== 'sample' &&
              stored.sourceId === expectedSource));
        if (matches) {
          const url = URL.createObjectURL(stored.file);
          sourceFile.current = stored.file;
          urlRef.current = url;
          setVideoUrl(url);
          setFileName(stored.file.name);
          if (expectedSource === 'legacy') {
            const migratedSourceId = stored.sourceId || uid();
            setSourceId(migratedSourceId);
            if (!stored.sourceId)
              void storeVideo(stored.file, migratedSourceId);
          }
        } else if (expectedSource !== 'sample') {
          setMissingSource(true);
          inform(
            'The saved edit needs its original recording. Import it again.',
          );
        }
        setReady(true);
      })
      .catch(() => {
        if (!stopped) {
          setReady(true);
          setSaveStatus('Browser storage unavailable');
        }
      });
    return () => {
      stopped = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [inform]);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(
          'take-project-v2',
          JSON.stringify({ project: p, sourceId }),
        );
        setSaveStatus('Saved on this device');
      } catch {
        setSaveStatus('Save project to keep changes');
      }
    }, 400);
    return () => clearTimeout(id);
  }, [p, ready, sourceId]);
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(''), 5000);
      return () => clearTimeout(id);
    }
  }, [notice]);
  useEffect(() => {
    setTime((t) => Math.min(t, total));
  }, [total]);
  useEffect(() => {
    const v = video.current;
    if (!v || !videoUrl) return;
    v.playbackRate = p.speed;
    v.muted = p.muted;
    if (playing && !exporting) {
      v.play().catch(() => {
        setPlaying(false);
        inform('Playback could not start. Try pressing play again.');
      });
    } else if (!exporting) v.pause();
  }, [playing, p.speed, p.muted, videoUrl, exporting, inform]);
  useEffect(() => {
    if (exporting) return;
    let raf = 0,
      last = performance.now(),
      lastUi = 0;
    let drawnProject: Project | null = null,
      drawnTime = -1,
      drawnVideo = -1,
      drawnReady = -1;
    const tick = (now: number) => {
      const state = live.current;
      let t = state.time;
      const v = video.current;
      if (state.playing) {
        t = Math.min(duration(state.p), t + Math.min((now - last) / 1000, 0.1));
        state.time = t;
        if (t >= duration(state.p)) {
          setPlaying(false);
          v?.pause();
        }
        if (now - lastUi >= 1000 / 30 || t >= duration(state.p)) {
          setTime(t);
          lastUi = now;
        }
      }
      last = now;
      if (v && videoUrl) {
        const target = sourceTime(state.p, t);
        if (Math.abs(v.currentTime - target) > (state.playing ? 0.2 : 0.025))
          v.currentTime = target;
      }
      if (
        canvas.current &&
        (drawnProject !== state.p ||
          drawnTime !== t ||
          drawnVideo !== (v?.currentTime ?? 0) ||
          drawnReady !== (v?.readyState ?? 0) ||
          v?.seeking)
      ) {
        renderFrame(canvas.current, state.p, t, videoUrl ? v : null);
        drawnProject = state.p;
        drawnTime = t;
        drawnVideo = v?.currentTime ?? 0;
        drawnReady = v?.readyState ?? 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoUrl, exporting]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        exporting ||
        exportOpen ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.closest(
          '[role="dialog"],[role="combobox"],[role="slider"]',
        )
      )
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        seek(time + 1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seek(time - 1);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === 'Delete' || e.key === 'Backspace')
      ) {
        if (tab === 'Zoom' && zoom) {
          e.preventDefault();
          removeZoom(zoom.id);
        } else if (tab === 'Text' && caption) {
          e.preventDefault();
          removeCaption(caption.id);
        } else if (tab === 'Clip' && clip) {
          e.preventDefault();
          removeClip(clip.id);
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  async function importFile(file?: File) {
    if (!file) return;
    if (
      !file.type.startsWith('video/') &&
      !/\.(mp4|webm|mov|m4v)$/i.test(file.name)
    ) {
      inform('Choose an MP4, WebM, or MOV video.');
      return;
    }
    setLoading(true);
    setPlaying(false);
    const url = URL.createObjectURL(file),
      probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('The video took too long to load.')),
          15000,
        );
        probe.onloadedmetadata = () => {
          clearTimeout(timer);
          resolve();
        };
        probe.onerror = () => {
          clearTimeout(timer);
          reject(
            new Error('This browser cannot decode that video. Try H.264 MP4.'),
          );
        };
      });
      if (!Number.isFinite(probe.duration) || probe.duration <= 0)
        throw new Error('The recording has no usable duration.');
      if (
        missingSource &&
        p.clips.some((clip) => clip.end > probe.duration + 0.1)
      )
        throw new Error('This recording is too short for the saved edit.');
      sourceDuration.current = probe.duration;
      setSourceHeight(probe.videoHeight || 1080);
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      sourceFile.current = file;
      const nextSourceId = uid();
      setVideoUrl(url);
      setSourceId(nextSourceId);
      setMissingSource(false);
      setFileName(file.name);
      if (!missingSource) {
        setP({
          ...initialProject,
          name: file.name.replace(/\.[^.]+$/, ''),
          zooms: [],
          captions: [],
          clips: [{ id: uid(), start: 0, end: probe.duration }],
        });
        setHistory([]);
        setFuture([]);
        setTime(0);
        setSelected('');
        setTab('Canvas');
      }
      try {
        await storeVideo(file, nextSourceId);
        inform(
          missingSource
            ? 'Recording reconnected to the saved edit.'
            : 'Video imported and saved on this device.',
        );
      } catch {
        inform('Video imported. Browser storage is full; keep this tab open.');
      }
    } catch (e) {
      URL.revokeObjectURL(url);
      inform((e as Error).message);
    } finally {
      probe.removeAttribute('src');
      probe.load();
      setLoading(false);
    }
  }
  async function exportVideoFast() {
    if (typeof VideoEncoder === 'undefined') return null;

    const media = await import('mediabunny');
    const {
      ALL_FORMATS,
      AudioSampleSink,
      AudioSampleSource,
      BlobSource,
      BufferTarget,
      CanvasSource,
      Input,
      Mp4OutputFormat,
      Output,
      Quality,
      VideoSampleSink,
      canEncodeAudio,
      canEncodeVideo,
    } = media;
    const [ew, eh] = size(p.ratio, exportQuality);
    const out = document.createElement('canvas');
    out.width = ew;
    out.height = eh;
    const frameRate = Number(fps);
    const frameDuration = 1 / frameRate;
    const videoQuality = new Quality({
      bitrate: Math.min(bitrate, 32_000_000),
      bitrateMode: 'variable',
    });
    const audioQuality = new Quality({
      bitrate: 192000,
      bitrateMode: 'variable',
    });
    let input: InstanceType<typeof Input> | null = null;

    try {
      if (videoUrl) {
        const blob =
          sourceFile.current ?? (await (await fetch(videoUrl)).blob());
        input = new Input({
          formats: ALL_FORMATS,
          source: new BlobSource(blob),
        });
      }

      const videoTrack = input ? await input.getPrimaryVideoTrack() : null;
      if (videoTrack && !(await videoTrack.canDecode())) return null;
      const audioTrack =
        input && !p.muted ? await input.getPrimaryAudioTrack() : null;
      if (audioTrack && (!(await audioTrack.canDecode()) || p.speed !== 1))
        return null;
      const inputStart = input ? await input.getFirstTimestamp() : 0;

      const audioOptions = audioTrack
        ? {
            numberOfChannels: await audioTrack.getNumberOfChannels(),
            sampleRate: await audioTrack.getSampleRate(),
            quality: audioQuality,
          }
        : null;
      const canUseMp4 =
        (await canEncodeVideo('avc', {
          width: ew,
          height: eh,
          quality: videoQuality,
          hardwareAcceleration: 'prefer-hardware',
        })) &&
        (!audioOptions || (await canEncodeAudio('aac', audioOptions)));
      if (!canUseMp4) return null;

      const format = new Mp4OutputFormat({ fastStart: 'in-memory' });
      const target = new BufferTarget();
      const output = new Output({ format, target });
      const videoSource = new CanvasSource(out, {
        codec: 'avc',
        quality: videoQuality,
        keyFrameInterval: 2,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'quality',
      });
      output.addVideoTrack(videoSource, { frameRate });
      const audioSource = audioOptions
        ? new AudioSampleSource({
            codec: 'aac',
            quality: audioQuality,
          })
        : null;
      if (audioSource) output.addAudioTrack(audioSource);
      await output.start();

      const encodeVideo = async () => {
        const sourceCanvas = document.createElement('canvas');
        const sourceContext = sourceCanvas.getContext('2d');
        if (videoTrack && sourceContext) {
          sourceCanvas.width = await videoTrack.getDisplayWidth();
          sourceCanvas.height = await videoTrack.getDisplayHeight();
          sourceContext.fillStyle = '#151815';
          sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
        }
        const frameCount = Math.max(1, Math.ceil(total * frameRate));
        const timestamps = function* () {
          for (let index = 0; index < frameCount; index++)
            yield (
              inputStart + sourceTime(p, Math.min(index * frameDuration, total))
            );
        };
        const samples = videoTrack
          ? new VideoSampleSink(videoTrack).samplesAtTimestamps(timestamps())
          : null;
        let index = 0;

        const addFrame = async (
          sample: Awaited<
            ReturnType<InstanceType<typeof VideoSampleSink>['getSample']>
          >,
        ) => {
          if (sample && sourceContext) {
            if (
              sourceCanvas.width !== sample.displayWidth ||
              sourceCanvas.height !== sample.displayHeight
            ) {
              sourceCanvas.width = sample.displayWidth;
              sourceCanvas.height = sample.displayHeight;
            }
            sample.draw(
              sourceContext,
              0,
              0,
              sourceCanvas.width,
              sourceCanvas.height,
            );
          }
          const timestamp = index * frameDuration;
          renderFrame(out, p, timestamp, videoTrack ? sourceCanvas : null);
          await videoSource.add(
            timestamp,
            Math.min(frameDuration, Math.max(0, total - timestamp)),
            { keyFrame: index % Math.max(1, Math.round(frameRate * 2)) === 0 },
          );
          sample?.close();
          index++;
          const nextProgress = Math.min(99, (index / frameCount) * 100);
          if (
            index === frameCount ||
            index % Math.max(1, Math.round(frameRate / 4)) === 0
          )
            setProgress(nextProgress);
        };

        if (samples) {
          for await (const sample of samples) {
            if (cancel.current) {
              sample?.close();
              break;
            }
            await addFrame(sample);
          }
        } else {
          while (index < frameCount && !cancel.current) await addFrame(null);
        }
      };

      const encodeAudio = async () => {
        if (!audioTrack || !audioSource) return;
        const sink = new AudioSampleSink(audioTrack);
        let outputOffset = 0;
        for (const clip of p.clips) {
          const clipStart = inputStart + clip.start;
          const clipEnd = inputStart + clip.end;
          for await (const sample of sink.samples(clipStart, clipEnd)) {
            if (cancel.current) {
              sample.close();
              return;
            }
            const startFrame = clamp(
              Math.ceil((clipStart - sample.timestamp) * sample.sampleRate),
              0,
              sample.numberOfFrames,
            );
            const endFrame = clamp(
              Math.ceil((clipEnd - sample.timestamp) * sample.sampleRate),
              startFrame,
              sample.numberOfFrames,
            );
            if (endFrame > startFrame) {
              const trimmed = sample.trim(startFrame, endFrame);
              trimmed.setTimestamp(
                outputOffset + trimmed.timestamp - clipStart,
              );
              await audioSource.add(trimmed);
              trimmed.close();
            }
            sample.close();
          }
          outputOffset += clip.end - clip.start;
        }
      };

      await Promise.all([encodeVideo(), encodeAudio()]);
      if (cancel.current) {
        await output.cancel();
        return { canceled: true as const };
      }
      await output.finalize();
      if (!target.buffer) throw new Error('The fast encoder returned no data.');
      return {
        canceled: false as const,
        blob: new Blob([target.buffer], { type: format.mimeType }),
        extension: format.fileExtension,
      };
    } finally {
      input?.dispose();
    }
  }

  async function exportVideo() {
    setPlaying(false);
    setExporting(true);
    setProgress(0);
    cancel.current = false;
    try {
      const fastExport = await exportVideoFast();
      if (fastExport) {
        if (!fastExport.canceled) {
          download(
            fastExport.blob,
            `${p.name || 'Take demo'}.${fastExport.extension}`,
          );
          setProgress(100);
          inform('Your video is ready. Download started.');
        }
        setExporting(false);
        setTime(0);
        return;
      }
    } catch (error) {
      console.warn('Fast export unavailable; using real-time export.', error);
      if (cancel.current) {
        setExporting(false);
        setTime(0);
        return;
      }
      setProgress(0);
    }

    if (typeof MediaRecorder === 'undefined') {
      inform(
        'No compatible local video encoder was found. Try Chrome or Edge.',
      );
      setExporting(false);
      return;
    }
    const mp4Types = ['video/mp4', 'video/mp4;codecs=avc1.42001f,mp4a.40.2'];
    const mime = mp4Types.find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) {
      inform(
        'MP4 export is unavailable in this browser. Open the editor in the latest Chrome or Edge.',
      );
      setExporting(false);
      return;
    }
    const out = document.createElement('canvas'),
      [ew, eh] = size(p.ratio, exportQuality);
    out.width = ew;
    out.height = eh;
    const recorderFrameRate = Math.min(Number(fps), 30);
    const stream = out.captureStream(recorderFrameRate),
      v = video.current;
    let dest: MediaStreamAudioDestinationNode | undefined,
      raf = 0;
    try {
      if (v && videoUrl) {
        v.pause();
        const start = sourceTime(p, 0);
        if (Math.abs(v.currentTime - start) > 0.01) {
          await new Promise<void>((res, rej) => {
            const timer = setTimeout(
              () => rej(new Error('Could not seek the source video.')),
              10000,
            );
            v.addEventListener(
              'seeked',
              () => {
                clearTimeout(timer);
                res();
              },
              { once: true },
            );
            v.currentTime = start;
          });
        }
        if (!p.muted) {
          if (!audio.current) {
            const context = new AudioContext();
            audio.current = {
              context,
              source: context.createMediaElementSource(v),
            };
            audio.current.source.connect(context.destination);
          }
          await audio.current.context.resume();
          dest = audio.current.context.createMediaStreamDestination();
          audio.current.source.connect(dest);
          dest.stream
            .getAudioTracks()
            .forEach((track) => stream.addTrack(track));
        }
        v.playbackRate = p.speed;
        v.muted = p.muted;
      }
      renderFrame(out, p, 0, videoUrl ? v : null);
      // MediaRecorder implementations become unreliable at very high target
      // bitrates. The MediaBunny fast path can use the full requested bitrate;
      // this compatibility path favors completing the export successfully.
      const recorderBitrate = Math.min(bitrate, 32_000_000);
      const recorder = new MediaRecorder(stream, {
          mimeType: mime,
          videoBitsPerSecond: recorderBitrate,
        }),
        chunks: BlobPart[] = [];
      const done = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
        recorder.onerror = (event) => {
          const encoderError = (event as Event & { error?: DOMException })
            .error;
          reject(
            encoderError ??
              new Error(
                'The compatibility video encoder stopped unexpectedly.',
              ),
          );
        };
      });
      // Observe rejection immediately. Waiting until the render loop finishes
      // allowed a mid-export encoder failure to surface as an unhandled promise.
      void done.catch(() => undefined);
      if (v && videoUrl) await v.play();
      recorder.start(250);
      let elapsed = 0,
        previous = performance.now(),
        lastRendered = 0,
        lastProgressUpdate = 0;
      if (Number(fps) > recorderFrameRate)
        inform(
          'This browser uses smooth 30 fps compatibility encoding. Chrome or Edge with WebCodecs can export at 60 fps.',
        );
      const frameInterval = 1000 / recorderFrameRate;
      const rendering = new Promise<void>((resolve) => {
        const frame = (now: number) => {
          const dt = Math.min((now - previous) / 1000, 0.1);
          previous = now;
          if (!(v && videoUrl && (v.seeking || v.readyState < 2)))
            elapsed += dt;
          const t = Math.min(total, elapsed);
          if (v && videoUrl) {
            const desired = sourceTime(p, t);
            if (Math.abs(v.currentTime - desired) > 0.3 && !v.seeking)
              v.currentTime = desired;
          }
          if (now - lastRendered >= frameInterval - 1 || t >= total) {
            renderFrame(out, p, t, videoUrl ? v : null);
            lastRendered = now;
          }
          if (now - lastProgressUpdate >= 100 || t >= total) {
            setProgress(Math.min(99, (t / total) * 100));
            lastProgressUpdate = now;
          }
          if (t >= total || cancel.current) {
            resolve();
            return;
          }
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      });
      await Promise.race([rendering, done.then(() => undefined)]);
      if (recorder.state !== 'inactive') recorder.stop();
      const blob = await done;
      if (!cancel.current) {
        download(blob, `${p.name || 'Take demo'}.mp4`);
        setProgress(100);
        inform('Your video is ready. Download started.');
      }
    } catch (e) {
      inform(`Export failed: ${(e as Error).message}`);
    } finally {
      cancelAnimationFrame(raf);
      v?.pause();
      stream.getTracks().forEach((t) => t.stop());
      if (dest && audio.current) audio.current.source.disconnect(dest);
      setExporting(false);
      setTime(0);
    }
  }
  async function openProject(file?: File) {
    if (!file) return;
    try {
      const next = validateProject(JSON.parse(await file.text()));
      if (next.clips.some((c) => c.end > sourceDuration.current + 0.1))
        throw new Error(
          'Import the matching source recording before opening this project.',
        );
      setP(next);
      setHistory([]);
      setFuture([]);
      setTime(0);
      setPlaying(false);
      inform('Project opened.');
    } catch (e) {
      inform((e as Error).message);
    }
  }
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: { registerTool: (t: unknown, o: unknown) => void };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      context.registerTool(
        {
          name: 'read_take_project',
          description: 'Read the current demo edit and duration.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: () => ({
            project: live.current.p,
            duration: duration(live.current.p),
          }),
        },
        { signal: controller.signal },
      );
      context.registerTool(
        {
          name: 'set_take_background',
          description: 'Set the current demo background preset.',
          inputSchema: {
            type: 'object',
            properties: { theme: { type: 'integer', minimum: 0, maximum: 5 } },
            required: ['theme'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: async (input: unknown) => {
            const n = (input as { theme: number }).theme;
            if (!Number.isInteger(n) || n < 0 || n > 5)
              throw new Error('Choose a theme from 0 through 5.');
            update({ theme: n });
            await new Promise(requestAnimationFrame);
            return { theme: n, name: themes[n].name };
          },
        },
        { signal: controller.signal },
      );
    } catch {
      console.warn('Optional WebMCP registration unavailable.');
    }
    return () => controller.abort();
  }, [update]);

  return (
    <main
      ref={root}
      className="studio"
      onDragOver={(e) => {
        e.preventDefault();
        if (!exporting) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!exporting) void importFile(e.dataTransfer.files[0]);
      }}
    >
      <input
        ref={backgroundInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          void uploadBackground(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept="video/*,.mp4,.webm,.mov"
        hidden
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={projectInput}
        type="file"
        accept=".json"
        hidden
        onChange={(e) => {
          void openProject(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <video
        ref={video}
        src={videoUrl || undefined}
        preload="auto"
        playsInline
        className="source-video"
        onLoadedMetadata={() => {
          sourceDuration.current = video.current?.duration || 24;
          setSourceHeight(video.current?.videoHeight || 1080);
        }}
        onError={() =>
          videoUrl &&
          inform('The recording could not be decoded. Import an H.264 MP4.')
        }
      />
      <header className="topbar">
        <a className="brand" href="/" aria-label="Take editor">
          <LogoMark className="editor-brand-mark" />
          take
        </a>
        <div className="project-name">
          <span>Workspace /</span>
          <input
            aria-label="Project name"
            value={p.name}
            maxLength={70}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
        <div className="header-actions">
          <span className="saved">
            <Check size={14} />
            {saveStatus}
          </span>
          <button
            className="btn"
            disabled={loading}
            onClick={() => fileInput.current?.click()}
          >
            {loading ? (
              <Loader2 className="spin" size={15} />
            ) : (
              <Upload size={15} />
            )}{' '}
            Import video
          </button>
          <button className="btn primary" onClick={() => setExportOpen(true)}>
            Export video <ArrowUpRight size={16} />
          </button>
        </div>
      </header>
      <div className="editor-body">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            const nextTab = String(v);
            if (nextTab !== tab) {
              setTab(nextTab);
              setInspectorOpen(true);
            }
          }}
          orientation="vertical"
          className="editor-tabs"
        >
          <TabsList className="tool-rail">
            {[
              { Icon: Layers, label: 'Canvas' },
              { Icon: ZoomIn, label: 'Zoom' },
              { Icon: MousePointer2, label: 'Cursor' },
              { Icon: Type, label: 'Text' },
              { Icon: Scissors, label: 'Clip' },
            ].map(({ Icon, label }) => (
              <TabsTrigger
                key={label}
                value={label}
                className="rail-item"
                aria-expanded={tab === label && inspectorOpen}
                title={
                  tab === label && inspectorOpen
                    ? `Hide ${label.toLowerCase()} panel`
                    : `Open ${label.toLowerCase()} panel`
                }
                onClick={() => {
                  if (tab === label) setInspectorOpen((open) => !open);
                  else setInspectorOpen(true);
                }}
              >
                <Icon size={20} />
                <span>{label}</span>
              </TabsTrigger>
            ))}
            <div className="rail-bottom">
              <button
                title="Save project file"
                aria-label="Save project file"
                onClick={() =>
                  download(
                    new Blob([JSON.stringify(p, null, 2)], {
                      type: 'application/json',
                    }),
                    `${p.name}.take.json`,
                  )
                }
              >
                <Download size={19} />
              </button>
              <button
                title="Open project file"
                aria-label="Open project file"
                onClick={() => projectInput.current?.click()}
              >
                <FolderOpen size={19} />
              </button>
            </div>
          </TabsList>
          {inspectorOpen && (
            <aside className="inspector">
              <div className="panel-heading">
                <h1>{tab}</h1>
              </div>
              <TabsContent value="Canvas">
                <div className="control-label">Format</div>
                <Choice
                  label="Aspect ratio"
                  value={p.ratio}
                  options={[
                    ['16:9', '▱  Landscape · 16:9'],
                    ['1:1', '□  Square · 1:1'],
                    ['9:16', '▯  Portrait · 9:16'],
                  ]}
                  onChange={(ratio) => update({ ratio })}
                />
                <div className="section-heading control-label">
                  Background <span>{themes[p.theme].name}</span>
                </div>
                <Choice
                  label="Background source"
                  value={p.backgroundMode ?? 'preset'}
                  options={[
                    ['preset', 'Background collection'],
                    ['color', 'Custom color'],
                    ['image', 'Your image'],
                  ]}
                  onChange={(v) =>
                    update({
                      backgroundMode: v as 'preset' | 'color' | 'image',
                    })
                  }
                />
                {p.backgroundMode === 'color' && (
                  <div className="custom-background">
                    <label htmlFor="bg-color">Background color</label>
                    <input
                      id="bg-color"
                      aria-label="Background color"
                      type="color"
                      value={p.backgroundColor ?? '#22352b'}
                      onChange={(e) =>
                        update({ backgroundColor: e.target.value })
                      }
                    />
                    <span>{p.backgroundColor ?? '#22352b'}</span>
                  </div>
                )}
                {p.backgroundMode === 'image' && (
                  <div className="custom-background image-background">
                    <button
                      className="btn wide"
                      onClick={() => backgroundInput.current?.click()}
                    >
                      <Upload size={14} />
                      {backgroundName ? 'Replace image' : 'Upload background'}
                    </button>
                    <p>{backgroundName || 'PNG, JPG or WebP · up to 20 MB'}</p>
                    <p>Centered and cropped to fill the canvas.</p>
                    {backgroundName && (
                      <button
                        className="btn wide"
                        onClick={() => update({ backgroundMode: 'preset' })}
                      >
                        Use collection instead
                      </button>
                    )}
                  </div>
                )}
                <div
                  className="preset-grid"
                  hidden={
                    p.backgroundMode === 'color' || p.backgroundMode === 'image'
                  }
                >
                  {themes.map((t, i) => (
                    <button
                      title={t.name}
                      aria-label={`${t.name} background`}
                      aria-pressed={p.theme === i}
                      key={t.name}
                      style={{
                        backgroundImage: t.image
                          ? `url(${t.image})`
                          : `linear-gradient(140deg,${t.colors.join(',')})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                      className={`preset ${p.theme === i ? 'selected' : ''}`}
                      onClick={() =>
                        update({
                          theme: i,
                          backgroundMode: 'preset',
                          texture: 'smooth',
                          mediaStyle: 'original',
                        })
                      }
                    >
                      <span className="preset-name">{t.name}</span>
                      {p.theme === i && <Check size={15} />}
                    </button>
                  ))}
                </div>
                <div
                  className="texture-card"
                  hidden={p.backgroundMode === 'color'}
                >
                  <div className="texture-heading">
                    <label>Background texture</label>
                  </div>
                  <Choice
                    label="Background texture"
                    value={
                      (p.backgroundMode === 'image' ||
                        themes[p.theme]?.image) &&
                      p.texture !== 'ascii'
                        ? 'smooth'
                        : p.texture
                    }
                    options={
                      p.backgroundMode === 'image' || themes[p.theme]?.image
                        ? [
                            ['smooth', 'Original image'],
                            ['ascii', 'ASCII image'],
                          ]
                        : [
                            ['smooth', 'Clean'],
                            ['dither', 'Dither pixels'],
                            ['grain', 'Fine grain'],
                            ['ascii', 'ASCII background'],
                          ]
                    }
                    onChange={(v) =>
                      update({
                        texture: v as Texture,
                        ...(v === 'ascii'
                          ? { mediaStyle: 'original' as const }
                          : {}),
                      })
                    }
                  />
                  {p.texture === 'ascii' && (
                    <div className="frame-options">
                      <label>Characters</label>
                      <Choice
                        label="Background ASCII characters"
                        value={p.backgroundCharacters ?? 'classic'}
                        options={Object.entries(asciiCharacterSets).map(
                          ([key, style]) => [key, style.label],
                        )}
                        onChange={(value) =>
                          update({
                            backgroundCharacters: value as AsciiCharacters,
                          })
                        }
                      />
                      <p className="panel-note">
                        Increase character scale for more readable shapes.
                      </p>
                    </div>
                  )}
                  {p.texture !== 'smooth' &&
                    (p.backgroundMode !== 'image' || p.texture === 'ascii') && (
                      <Range
                        label="Intensity"
                        value={p.textureStrength}
                        unit="%"
                        onChange={(textureStrength) =>
                          update({ textureStrength })
                        }
                      />
                    )}
                  {((p.texture === 'dither' && p.backgroundMode !== 'image') ||
                    p.texture === 'ascii') && (
                    <Range
                      label={
                        p.texture === 'ascii' ? 'Character scale' : 'Pixel size'
                      }
                      value={p.pixelSize}
                      min={1}
                      max={8}
                      unit=" px"
                      onChange={(pixelSize) => update({ pixelSize })}
                    />
                  )}
                </div>
                <div className="media-style-control">
                  <div className="control-label">Recording style</div>
                  <Choice
                    label="Recording style"
                    value={p.mediaStyle ?? 'original'}
                    options={[
                      ['original', 'Original'],
                      ['ascii', 'ASCII · Full color'],
                    ]}
                    onChange={(mediaStyle) =>
                      update({ mediaStyle: mediaStyle as 'original' | 'ascii' })
                    }
                  />
                  {(p.mediaStyle ?? 'original') === 'ascii' && (
                    <Range
                      label="Character size"
                      value={p.asciiSize ?? 10}
                      min={6}
                      max={18}
                      unit=" px"
                      onChange={(asciiSize) => update({ asciiSize })}
                    />
                  )}
                </div>
                <div className="section-heading">Frame</div>
                <div
                  className="frame-picker"
                  role="group"
                  aria-label="Mockup frame"
                >
                  {(['clean', 'browser', 'desktop'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      aria-pressed={(p.frameStyle ?? 'clean') === style}
                      onClick={() => update({ frameStyle: style })}
                    >
                      <span
                        className={`frame-mini frame-mini-${style}`}
                        aria-hidden="true"
                      >
                        {style !== 'clean' && (
                          <span className="frame-mini-bar">
                            <i />
                            <i />
                            <i />
                            {style === 'browser' && <b />}
                          </span>
                        )}
                        <span className="frame-mini-content" />
                      </span>
                      <span>
                        {style === 'clean'
                          ? 'Clean'
                          : style === 'browser'
                            ? 'Browser'
                            : 'Desktop'}
                      </span>
                    </button>
                  ))}
                </div>
                {p.frameStyle && p.frameStyle !== 'clean' && (
                  <div className="frame-options">
                    <label>Appearance</label>
                    <Choice
                      label="Frame appearance"
                      value={p.frameTone ?? 'light'}
                      options={[
                        ['light', 'Light'],
                        ['dark', 'Dark'],
                      ]}
                      onChange={(frameTone) =>
                        update({ frameTone: frameTone as 'light' | 'dark' })
                      }
                    />
                    {p.frameStyle === 'desktop' && (
                      <>
                        <label>Window controls</label>
                        <Choice
                          label="Window controls"
                          value={p.windowControls ?? 'mac'}
                          options={[
                            ['mac', 'macOS'],
                            ['windows', 'Windows'],
                          ]}
                          onChange={(windowControls) =>
                            update({
                              windowControls: windowControls as
                                | 'mac'
                                | 'windows',
                            })
                          }
                        />
                      </>
                    )}
                    <label htmlFor="frame-title">
                      {p.frameStyle === 'browser'
                        ? 'Display URL'
                        : 'Window title'}
                    </label>
                    <input
                      id="frame-title"
                      type="text"
                      maxLength={120}
                      value={p.frameTitle ?? ''}
                      placeholder={
                        p.frameStyle === 'browser' ? 'yourapp.com' : 'Your app'
                      }
                      onChange={(e) => update({ frameTitle: e.target.value })}
                    />
                  </div>
                )}
                <Range
                  label="Padding"
                  value={p.padding}
                  max={180}
                  unit=" px"
                  onChange={(padding) => update({ padding })}
                />
                <Range
                  label="Corner radius"
                  value={p.radius}
                  max={60}
                  unit=" px"
                  onChange={(radius) => update({ radius })}
                />
                <Range
                  label="Shadow"
                  value={p.shadow}
                  unit="%"
                  onChange={(shadow) => update({ shadow })}
                />
                <Range
                  label="Background blur"
                  value={p.backgroundBlur ?? 0}
                  max={30}
                  unit=" px"
                  onChange={(backgroundBlur) => update({ backgroundBlur })}
                />
                <div className="tip">
                  <Sparkles size={17} />
                  <p>
                    A little space goes a long way.
                    <br />
                    <span>Give your product room to shine.</span>
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="Zoom">
                <div className="auto-focus-card">
                  <div>
                    <Sparkles size={16} />
                    <span>
                      <b>Auto focus</b>
                      <small>Find visible activity and add gentle zooms.</small>
                    </span>
                  </div>
                  <button
                    className="btn"
                    disabled={analyzing || missingSource}
                    onClick={() => void autoFocus()}
                  >
                    {analyzing ? (
                      <Loader2 className="spin" size={14} />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {analyzing ? 'Analyzing' : 'Generate'}
                  </button>
                </div>
                <button className="btn wide" onClick={addZoom}>
                  <Plus size={14} /> Add zoom at playhead
                </button>
                <div className="event-list">
                  {p.zooms.map((z, i) => (
                    <button
                      key={z.id}
                      className={selected === z.id ? 'chosen' : ''}
                      onClick={() => {
                        setSelected(z.id);
                        seek(z.start + 0.7);
                        setPlaying(false);
                      }}
                    >
                      <ZoomIn size={14} />
                      <span>Zoom {i + 1}</span>
                      <small>{formatTime(z.start)}</small>
                    </button>
                  ))}
                </div>
                {zoom ? (
                  <>
                    <Range
                      label="Magnification"
                      value={zoom.scale}
                      min={1}
                      max={2}
                      step={0.01}
                      unit="×"
                      onChange={(scale) => editZoom({ scale })}
                    />
                    <Range
                      label="Start"
                      value={zoom.start}
                      max={Math.max(0, total - 0.2)}
                      step={0.1}
                      unit=" s"
                      onChange={(start) =>
                        editZoom({
                          start,
                          duration: Math.min(zoom.duration, total - start),
                        })
                      }
                    />
                    <Range
                      label="Duration"
                      value={zoom.duration}
                      min={0.2}
                      max={Math.max(0.2, total - zoom.start)}
                      step={0.1}
                      unit=" s"
                      onChange={(duration) => editZoom({ duration })}
                    />
                    <p className="panel-note">
                      Click the preview to move the focus point. Smooth easing
                      is applied automatically.
                    </p>
                    <button
                      className="btn danger wide"
                      onClick={() => removeZoom()}
                    >
                      <Trash2 size={14} /> Remove zoom
                    </button>
                  </>
                ) : (
                  <p className="empty-note">
                    Add a zoom or select one on the timeline.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="Cursor">
                <p className="panel-note">
                  The sample has a separate cursor you can customize.
                </p>
                <div className="switch-row">
                  <label htmlFor="cursor">Show sample cursor</label>
                  <Switch
                    id="cursor"
                    checked={p.cursor}
                    disabled={!!videoUrl}
                    onCheckedChange={(cursor) => update({ cursor })}
                  />
                </div>
                <Range
                  label="Cursor size"
                  value={p.cursorSize}
                  min={12}
                  max={60}
                  unit=" px"
                  onChange={(cursorSize) => update({ cursorSize })}
                />
                <div className="tip">
                  <MousePointer2 size={17} />
                  <p>
                    {videoUrl
                      ? 'Your video’s cursor is baked into the recording.'
                      : 'Cursor styling applies to the sample.'}
                    <br />
                    <span>
                      Imported videos keep their original cursor. Separate
                      cursor capture comes with a future recorder.
                    </span>
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="Text">
                <p className="panel-note">A few words. A clearer story.</p>
                <button className="btn wide" onClick={addText}>
                  <Plus size={14} /> Add callout
                </button>
                <div className="event-list">
                  {p.captions.map((c) => (
                    <button
                      key={c.id}
                      className={selected === c.id ? 'chosen' : ''}
                      onClick={() => {
                        setSelected(c.id);
                        seek(c.start + 0.1);
                      }}
                    >
                      <Type size={14} />
                      <span>{c.text.slice(0, 22)}</span>
                    </button>
                  ))}
                </div>
                {caption ? (
                  <>
                    <label htmlFor="callout">Callout text</label>
                    <textarea
                      id="callout"
                      maxLength={240}
                      value={caption.text}
                      onChange={(e) =>
                        update({
                          captions: p.captions.map((c) =>
                            c.id === selected
                              ? { ...c, text: e.target.value }
                              : c,
                          ),
                        })
                      }
                    />
                    <Range
                      label="Start"
                      value={caption.start}
                      max={Math.max(0, total - 0.2)}
                      step={0.1}
                      unit=" s"
                      onChange={(start) =>
                        update({
                          captions: p.captions.map((c) =>
                            c.id === selected
                              ? {
                                  ...c,
                                  start,
                                  duration: Math.min(c.duration, total - start),
                                }
                              : c,
                          ),
                        })
                      }
                    />
                    <Range
                      label="Duration"
                      value={caption.duration}
                      min={0.2}
                      max={Math.max(0.2, total - caption.start)}
                      step={0.1}
                      unit=" s"
                      onChange={(duration) =>
                        update({
                          captions: p.captions.map((c) =>
                            c.id === selected ? { ...c, duration } : c,
                          ),
                        })
                      }
                    />
                    <button
                      className="btn danger wide"
                      onClick={() => removeCaption()}
                    >
                      <Trash2 size={14} /> Remove callout
                    </button>
                  </>
                ) : (
                  <p className="empty-note">
                    Callouts appear in your preview and exported video.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="Clip">
                <p className="panel-note">
                  Select a clip on the timeline to trim it. Split and remove
                  segments to cut pauses.
                </p>
                <label>Playback speed</label>
                <Choice
                  label="Playback speed"
                  value={String(p.speed)}
                  options={[
                    ['0.5', '0.5× · Slow'],
                    ['1', '1× · Normal'],
                    ['1.5', '1.5× · Brisk'],
                    ['2', '2× · Fast'],
                  ]}
                  onChange={(v) => {
                    update({ speed: Number(v) });
                    seek(0);
                  }}
                />
                <div className="switch-row">
                  <label htmlFor="audio">Include original audio</label>
                  <Switch
                    id="audio"
                    checked={!p.muted}
                    onCheckedChange={(v) => update({ muted: !v })}
                  />
                </div>
                {clip ? (
                  <>
                    <Range
                      label="Trim start"
                      value={clip.start}
                      max={Math.max(0, clip.end - 0.1)}
                      step={0.1}
                      unit=" s"
                      onChange={(start) => {
                        update({
                          clips: p.clips.map((c) =>
                            c.id === clip.id ? { ...c, start } : c,
                          ),
                        });
                        setPlaying(false);
                      }}
                    />
                    <Range
                      label="Trim end"
                      value={clip.end}
                      min={clip.start + 0.1}
                      max={sourceDuration.current}
                      step={0.1}
                      unit=" s"
                      onChange={(end) => {
                        update({
                          clips: p.clips.map((c) =>
                            c.id === clip.id ? { ...c, end } : c,
                          ),
                        });
                        setPlaying(false);
                      }}
                    />
                    <button
                      className="btn danger wide"
                      disabled={p.clips.length === 1}
                      onClick={() => removeClip(clip.id)}
                    >
                      <Trash2 size={14} /> Delete selected clip
                    </button>
                  </>
                ) : (
                  <p className="empty-note">Select a video segment below.</p>
                )}
              </TabsContent>
            </aside>
          )}
        </Tabs>
        <section ref={stage} className="main-stage">
          <div className="stage-heading">
            <span>
              <i />
              {p.name || 'Untitled demo'}{' '}
              {sourceId === 'sample' && !missingSource && (
                <span className="sample-badge">SAMPLE</span>
              )}
            </span>
            <span>
              PREVIEW <span className="separator">/</span> {W} × {H}
            </span>
          </div>
          <div className="preview-space">
            <canvas
              ref={canvas}
              width={W}
              height={H}
              className={`render-canvas ${tab === 'Zoom' && zoom ? 'focus-mode' : ''} ${missingSource ? 'source-missing' : ''}`}
              style={{
                aspectRatio: p.ratio.replace(':', '/'),
                maxHeight: p.ratio === '16:9' ? '60vh' : '53vh',
                width: p.ratio === '16:9' ? '100%' : 'auto',
              }}
              aria-label="Video preview. In Zoom mode, click to position the camera focus."
              onClick={(e) => {
                if (tab !== 'Zoom' || !zoom) return;
                const r = e.currentTarget.getBoundingClientRect(),
                  v = video.current;
                const sw = videoUrl && v ? v.videoWidth || 1280 : 1280,
                  sh = videoUrl && v ? v.videoHeight || 800 : 800;
                const {
                  w: fw,
                  h: fh,
                  contentX: fx,
                  contentY: fy,
                } = frameLayout(W, H, sw, sh, p.padding, p.frameStyle);
                editZoom({
                  x: clamp(
                    (((e.clientX - r.left) / r.width) * W - fx) / fw,
                    0,
                    1,
                  ),
                  y: clamp(
                    (((e.clientY - r.top) / r.height) * H - fy) / fh,
                    0,
                    1,
                  ),
                });
                seek(zoom.start + 0.7);
              }}
            />
            {missingSource && (
              <div className="missing-source">
                <Film size={24} />
                <b>Recording unavailable</b>
                <span>
                  Reconnect the original recording to continue editing.
                </span>
                <button
                  className="btn"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload size={14} /> Import recording
                </button>
              </div>
            )}
          </div>
          <div className="playback">
            <span>
              {formatTime(time)}
              <span className="muted"> / {formatTime(total)}</span>
            </span>
            <div>
              <button aria-label="Go to start" onClick={() => seek(0)}>
                <SkipBack size={16} />
              </button>
              <button
                className="play-button"
                aria-label={playing ? 'Pause' : 'Play'}
                title="Play / Pause (Space)"
                onClick={toggle}
              >
                {playing ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
              </button>
              <button
                aria-label="Go to end"
                onClick={() => {
                  seek(total);
                  setPlaying(false);
                }}
              >
                <SkipForward size={16} />
              </button>
            </div>
            <div>
              <button
                aria-label={p.muted ? 'Unmute' : 'Mute'}
                onClick={() => update({ muted: !p.muted })}
              >
                {p.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <button
                className="fullscreen-button"
                aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                title={
                  fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen preview'
                }
                onClick={() => void toggleFullscreen()}
              >
                {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>
        </section>
      </div>
      <section className="timeline">
        <div className="timeline-toolbar">
          <div>
            <button
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              disabled={!history.length}
              onClick={undo}
            >
              <Undo2 size={16} />
            </button>
            <button
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={16} />
            </button>
            <span className="divider" />
            <button onClick={split}>
              <Scissors size={16} /> Split
            </button>
          </div>
          <div>
            <button className="btn" onClick={addZoom}>
              <Plus size={14} /> Add zoom
            </button>
            <button className="btn" onClick={addText}>
              <Type size={14} /> Add text
            </button>
            <span className="timeline-scale" aria-label="Timeline scale">
              <button
                aria-label="Zoom timeline out"
                title="Zoom timeline out"
                disabled={timelineScale === 1}
                onClick={() =>
                  setTimelineScale((value) => Math.max(1, value - 0.5))
                }
              >
                <ZoomOut size={14} />
              </button>
              <output>{timelineScale.toFixed(1)}×</output>
              <button
                aria-label="Zoom timeline in"
                title="Zoom timeline in"
                disabled={timelineScale === 4}
                onClick={() =>
                  setTimelineScale((value) => Math.min(4, value + 0.5))
                }
              >
                <ZoomIn size={14} />
              </button>
            </span>
          </div>
          <span>{total.toFixed(1)} seconds</span>
        </div>
        <div className="tracks">
          <div className="track-labels">
            <span>Timeline</span>
            <span>
              <Film size={15} /> Video
            </span>
            <span>
              <ZoomIn size={15} /> Zoom
            </span>
            {p.captions.length > 0 && (
              <span>
                <Type size={15} /> Text
              </span>
            )}
          </div>
          <div className="track-viewport">
            <div
              className="track-content"
              style={{ width: `${timelineScale * 100}%` }}
            >
              <div
                className="ruler"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const r = e.currentTarget.getBoundingClientRect();
                  seek(((e.clientX - r.left) / r.width) * total);
                  setPlaying(false);
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 1) {
                    const r = e.currentTarget.getBoundingClientRect();
                    seek(((e.clientX - r.left) / r.width) * total);
                  }
                }}
              >
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i}>{formatTime((total * i) / 6)}</span>
                ))}
              </div>
              <input
                className="timeline-scrubber"
                aria-label="Playhead position"
                type="range"
                min={0}
                max={total}
                step={0.01}
                value={time}
                onChange={(e) => {
                  seek(Number(e.target.value));
                  setPlaying(false);
                }}
              />
              <div className="clips-row">
                {p.clips.map((c, i) => (
                  <button
                    key={c.id}
                    className={`video-track ${tab === 'Clip' && selectedClip === c.id ? 'clip-selected' : ''}`}
                    style={{ flex: c.end - c.start }}
                    title={`Select clip ${i + 1}`}
                    onClick={() => {
                      if (suppressClipClick.current) {
                        suppressClipClick.current = false;
                        return;
                      }
                      setSelectedClip(c.id);
                      setTab('Clip');
                      seek(
                        p.clips
                          .slice(0, i)
                          .reduce((s, c) => s + c.end - c.start, 0) / p.speed,
                      );
                    }}
                  >
                    <span
                      className="clip-handle clip-handle-start"
                      aria-hidden="true"
                      onPointerDown={(event) =>
                        startClipTrim(event, c, 'start')
                      }
                      onPointerMove={moveClipTrim}
                      onPointerUp={(event) => {
                        if (clipDrag.current?.pointerId === event.pointerId)
                          clipDrag.current = null;
                      }}
                      onPointerCancel={() => {
                        clipDrag.current = null;
                      }}
                    />
                    {Array.from(
                      {
                        length: Math.max(
                          2,
                          Math.round(
                            ((c.end - c.start) / (total * p.speed)) * 16,
                          ),
                        ),
                      },
                      (_, j) => (
                        <div key={j} className="mini-frame">
                          <i />
                          <i />
                          <i />
                        </div>
                      ),
                    )}
                    <span className="clip-title">
                      {fileName}
                      {p.clips.length > 1 ? ` · ${i + 1}` : ''}
                    </span>
                    <span
                      className="clip-handle clip-handle-end"
                      aria-hidden="true"
                      onPointerDown={(event) => startClipTrim(event, c, 'end')}
                      onPointerMove={moveClipTrim}
                      onPointerUp={(event) => {
                        if (clipDrag.current?.pointerId === event.pointerId)
                          clipDrag.current = null;
                      }}
                      onPointerCancel={() => {
                        clipDrag.current = null;
                      }}
                    />
                  </button>
                ))}
              </div>
              <div className="event-track">
                {p.zooms.map((z, i) => (
                  <button
                    key={z.id}
                    className={
                      tab === 'Zoom' && selected === z.id
                        ? 'event-selected'
                        : ''
                    }
                    style={{
                      left: `${(z.start / total) * 100}%`,
                      width: `${(Math.min(z.duration, total - z.start) / total) * 100}%`,
                    }}
                    aria-label={`Zoom ${i + 1}. Drag to move. Press Delete to remove.`}
                    title="Drag to move · Delete to remove"
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      const track = e.currentTarget.parentElement;
                      if (!track) return;
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      zoomDrag.current = {
                        id: z.id,
                        pointerId: e.pointerId,
                        mode: 'move',
                        startX: e.clientX,
                        start: z.start,
                        duration: z.duration,
                        trackWidth: track.getBoundingClientRect().width,
                        moved: false,
                      };
                      suppressZoomClick.current = false;
                      setSelected(z.id);
                      setTab('Zoom');
                      setPlaying(false);
                    }}
                    onPointerMove={(e) => {
                      const drag = zoomDrag.current;
                      if (!drag || drag.pointerId !== e.pointerId) return;
                      const distance = e.clientX - drag.startX;
                      if (!drag.moved && Math.abs(distance) < 2) return;
                      drag.moved = true;
                      suppressZoomClick.current = true;
                      const current = live.current.p;
                      const moving = current.zooms.find(
                        (item) => item.id === drag.id,
                      );
                      if (!moving || drag.trackWidth <= 0) return;
                      const projectDuration = duration(current),
                        delta = (distance / drag.trackWidth) * projectDuration;
                      update({
                        zooms: current.zooms.map((item) =>
                          item.id !== drag.id
                            ? item
                            : drag.mode === 'move'
                              ? {
                                  ...item,
                                  start: clamp(
                                    drag.start + delta,
                                    0,
                                    Math.max(
                                      0,
                                      projectDuration - drag.duration,
                                    ),
                                  ),
                                }
                              : drag.mode === 'start'
                                ? {
                                    ...item,
                                    start: clamp(
                                      drag.start + delta,
                                      0,
                                      drag.start + drag.duration - 0.25,
                                    ),
                                    duration:
                                      drag.duration -
                                      clamp(
                                        delta,
                                        -drag.start,
                                        drag.duration - 0.25,
                                      ),
                                  }
                                : {
                                    ...item,
                                    duration: clamp(
                                      drag.duration + delta,
                                      0.25,
                                      projectDuration - drag.start,
                                    ),
                                  },
                        ),
                      });
                      const changed = live.current.p.zooms.find(
                        (item) => item.id === drag.id,
                      );
                      seek(
                        (changed?.start ?? moving.start) +
                          Math.min(
                            0.7,
                            (changed?.duration ?? moving.duration) / 2,
                          ),
                      );
                    }}
                    onPointerUp={(e) => {
                      if (zoomDrag.current?.pointerId === e.pointerId)
                        zoomDrag.current = null;
                    }}
                    onPointerCancel={() => {
                      zoomDrag.current = null;
                      suppressZoomClick.current = false;
                    }}
                    onClick={() => {
                      if (suppressZoomClick.current) {
                        suppressZoomClick.current = false;
                        return;
                      }
                      setSelected(z.id);
                      setTab('Zoom');
                      const current = live.current.p.zooms.find(
                        (item) => item.id === z.id,
                      );
                      seek((current?.start ?? z.start) + 0.7);
                      setPlaying(false);
                    }}
                  >
                    <span
                      className="event-handle event-handle-start"
                      aria-hidden="true"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const track =
                          e.currentTarget.parentElement?.parentElement;
                        if (!track) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        zoomDrag.current = {
                          id: z.id,
                          pointerId: e.pointerId,
                          mode: 'start',
                          startX: e.clientX,
                          start: z.start,
                          duration: z.duration,
                          trackWidth: track.getBoundingClientRect().width,
                          moved: true,
                        };
                        setSelected(z.id);
                        setTab('Zoom');
                        setPlaying(false);
                      }}
                    />
                    <ZoomIn size={12} /> Zoom {i + 1}{' '}
                    <span className="event-value">{z.scale.toFixed(2)}×</span>
                    <span
                      className="event-handle event-handle-end"
                      aria-hidden="true"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const track =
                          e.currentTarget.parentElement?.parentElement;
                        if (!track) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        zoomDrag.current = {
                          id: z.id,
                          pointerId: e.pointerId,
                          mode: 'end',
                          startX: e.clientX,
                          start: z.start,
                          duration: z.duration,
                          trackWidth: track.getBoundingClientRect().width,
                          moved: true,
                        };
                        setSelected(z.id);
                        setTab('Zoom');
                        setPlaying(false);
                      }}
                    />
                  </button>
                ))}
              </div>
              {p.captions.length > 0 && (
                <div className="event-track text-track">
                  {p.captions.map((c) => (
                    <button
                      key={c.id}
                      className={
                        tab === 'Text' && selected === c.id
                          ? 'event-selected'
                          : ''
                      }
                      style={{
                        left: `${(c.start / total) * 100}%`,
                        width: `${(Math.min(c.duration, total - c.start) / total) * 100}%`,
                      }}
                      aria-label={`Callout ${c.text}. Drag to move. Press Delete to remove.`}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        const track = e.currentTarget.parentElement;
                        if (!track) return;
                        e.preventDefault();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        captionDrag.current = {
                          id: c.id,
                          pointerId: e.pointerId,
                          mode: 'move',
                          startX: e.clientX,
                          start: c.start,
                          duration: c.duration,
                          trackWidth: track.getBoundingClientRect().width,
                        };
                        suppressCaptionClick.current = false;
                        setSelected(c.id);
                        setTab('Text');
                        setPlaying(false);
                      }}
                      onPointerMove={(e) => {
                        const drag = captionDrag.current;
                        if (
                          !drag ||
                          drag.pointerId !== e.pointerId ||
                          drag.trackWidth <= 0
                        )
                          return;
                        const delta =
                          ((e.clientX - drag.startX) / drag.trackWidth) * total;
                        if (Math.abs(e.clientX - drag.startX) > 2)
                          suppressCaptionClick.current = true;
                        const current = live.current.p;
                        let nextStart = drag.start;
                        update({
                          captions: current.captions.map((item) => {
                            if (item.id !== drag.id) return item;
                            if (drag.mode === 'move') {
                              nextStart = clamp(
                                drag.start + delta,
                                0,
                                Math.max(0, total - drag.duration),
                              );
                              return { ...item, start: nextStart };
                            }
                            if (drag.mode === 'start') {
                              nextStart = clamp(
                                drag.start + delta,
                                0,
                                drag.start + drag.duration - 0.25,
                              );
                              return {
                                ...item,
                                start: nextStart,
                                duration:
                                  drag.duration -
                                  clamp(
                                    delta,
                                    -drag.start,
                                    drag.duration - 0.25,
                                  ),
                              };
                            }
                            return {
                              ...item,
                              duration: clamp(
                                drag.duration + delta,
                                0.25,
                                total - drag.start,
                              ),
                            };
                          }),
                        });
                        seek(nextStart + 0.1);
                      }}
                      onPointerUp={(e) => {
                        if (captionDrag.current?.pointerId === e.pointerId)
                          captionDrag.current = null;
                      }}
                      onPointerCancel={() => {
                        captionDrag.current = null;
                      }}
                      onClick={() => {
                        if (suppressCaptionClick.current) {
                          suppressCaptionClick.current = false;
                          return;
                        }
                        setSelected(c.id);
                        setTab('Text');
                        seek(c.start + 0.1);
                      }}
                    >
                      <span
                        className="event-handle event-handle-start"
                        aria-hidden="true"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const track =
                            e.currentTarget.parentElement?.parentElement;
                          if (!track) return;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          captionDrag.current = {
                            id: c.id,
                            pointerId: e.pointerId,
                            mode: 'start',
                            startX: e.clientX,
                            start: c.start,
                            duration: c.duration,
                            trackWidth: track.getBoundingClientRect().width,
                          };
                          suppressCaptionClick.current = true;
                          setSelected(c.id);
                          setTab('Text');
                          setPlaying(false);
                        }}
                      />
                      <Type size={12} />
                      {c.text}
                      <span
                        className="event-handle event-handle-end"
                        aria-hidden="true"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const track =
                            e.currentTarget.parentElement?.parentElement;
                          if (!track) return;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          captionDrag.current = {
                            id: c.id,
                            pointerId: e.pointerId,
                            mode: 'end',
                            startX: e.clientX,
                            start: c.start,
                            duration: c.duration,
                            trackWidth: track.getBoundingClientRect().width,
                          };
                          suppressCaptionClick.current = true;
                          setSelected(c.id);
                          setTab('Text');
                          setPlaying(false);
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
              <div
                className="playhead"
                style={{ left: `${(time / total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </section>
      <footer className="statusbar">
        <span>
          <span className="status-dot" /> Files stay on this device
        </span>
        <span>
          {saveStatus} <span className="status-separator">·</span>{' '}
          {formatTime(total)} project
        </span>
      </footer>
      <div
        className="toast-message"
        role="status"
        data-visible={!!notice}
        aria-hidden={!notice}
      >
        <Check size={15} />
        {notice}
        <button
          aria-label="Dismiss notification"
          tabIndex={notice ? 0 : -1}
          onClick={() => setNotice('')}
        >
          ×
        </button>
      </div>
      {dragging && (
        <div className="drop-overlay">
          <Upload size={38} />
          <h2>Drop your recording here</h2>
          <p>MP4, WebM, or MOV</p>
        </div>
      )}
      <Dialog
        open={exportOpen}
        onOpenChange={(v) => {
          if (!exporting) setExportOpen(v);
        }}
      >
        <DialogContent className="export-dialog" showCloseButton={!exporting}>
          <div className="export-dialog-body">
            <DialogTitle>Ready for your close-up.</DialogTitle>
            <DialogDescription>
              Export your edit with backgrounds, zooms, and callouts included.
            </DialogDescription>
            <div className="export-summary">
              <Film size={26} />
              <div>
                <b>{p.name}</b>
                <span>
                  {formatTime(total)} ·{' '}
                  {size(p.ratio, exportQuality).join(' × ')} ·{' '}
                  {effectiveExportFps} fps · MP4
                </span>
              </div>
            </div>
            <label>Resolution</label>
            <Choice
              label="Export resolution"
              value={quality}
              options={[
                ['source', `Match source · ${sourceHeight || 1080}p`],
                ['720', '720p · Smaller file'],
                ['1080', '1080p · High quality'],
                ['1440', '1440p · QHD'],
                ['2160', '2160p · 4K'],
              ]}
              onChange={setQuality}
            />
            <label>Frame rate</label>
            <Choice
              label="Export frame rate"
              value={fps}
              options={[
                ['24', '24 fps · Cinematic'],
                ['30', '30 fps · Standard'],
                [
                  '60',
                  webCodecsAvailable
                    ? '60 fps · Smooth'
                    : '60 fps · Requires WebCodecs',
                ],
                [
                  '120',
                  webCodecsAvailable
                    ? '120 fps · High refresh'
                    : '120 fps · Requires WebCodecs',
                ],
              ]}
              onChange={setFps}
            />
            <label>Encoding quality</label>
            <Choice
              label="Encoding quality"
              value={encodingQuality}
              options={[
                ['compact', 'Compact · Smaller file'],
                ['high', 'High · Recommended'],
                ['maximum', 'Maximum · Best detail'],
              ]}
              onChange={setEncodingQuality}
            />
            <label>Target bitrate</label>
            <Choice
              label="Export target bitrate"
              value={bitrateSetting}
              options={[
                ['auto', 'Auto · Based on resolution'],
                ['4', '4 Mbps · Compact'],
                ['8', '8 Mbps · Standard HD'],
                ['16', '16 Mbps · High detail'],
                ['32', '32 Mbps · Maximum'],
              ]}
              onChange={setBitrateSetting}
            />
            <p className="panel-note">
              Target {(bitrate / 1000000).toFixed(1)} Mbps · estimated{' '}
              {Math.round((bitrate * total) / 8 / 1000000)} MB. Higher settings
              cannot restore detail or frames missing from the source. Actual
              frame rate depends on your device. The quality preset adjusts
              bitrate only when Target bitrate is set to Auto. High frame rates
              make Take's camera motion smoother but cannot invent detail
              between frames in the source recording.
            </p>
            <p className="panel-note">
              {webCodecsAvailable
                ? 'MediaBunny uses deterministic frame timing and H.264 for smooth MP4 exports.'
                : 'This browser lacks WebCodecs, so MP4 compatibility exports are capped at a stable 30 fps.'}{' '}
              Keep this tab visible until it finishes.
            </p>
          </div>
          {exporting ? (
            <>
              <Progress aria-label="Export progress" value={progress} />
              <div className="export-progress">
                <span>Encoding your demo… {Math.round(progress)}%</span>
                <button
                  onClick={() => {
                    cancel.current = true;
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button
              className="btn primary wide"
              onClick={() => void exportVideo()}
            >
              <Download size={16} /> Export & download
            </button>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
