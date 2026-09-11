'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Play,
  Pause,
  Scissors,
  Scan,
  Focus,
  Check,
  Film,
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import { LogoMark } from '@/components/logo-mark';
import {
  initialProject,
  renderFrame,
  themes,
  type Project,
} from '@/lib/editor';
import './landing.css';

const steps = [
  {
    title: 'Cut the waiting.',
    text: 'Keep the useful part. Trim the beginning and end, or split a clip to remove a pause.',
    icon: Scissors,
  },
  {
    title: 'Set the frame.',
    text: 'Choose a background, adjust the spacing, and give your recording a little breathing room.',
    icon: Scan,
  },
  {
    title: 'Focus the action.',
    text: 'Follow the cursor to the selected project without losing the rest of the screen.',
    icon: Focus,
  },
];
const backdropIds = [2, 3, 1, 0];
function demoProject(
  theme: number,
  edited: boolean,
  step: number,
  zoom: number,
): Project {
  return {
    ...initialProject,
    theme,
    backgroundMode: edited ? 'preset' : 'color',
    backgroundColor: '#e9e9e7',
    padding: edited && step >= 1 ? 110 : 0,
    radius: edited && step >= 1 ? 16 : 0,
    shadow: edited && step >= 1 ? 45 : 0,
    texture: 'dither',
    textureStrength: 28,
    zooms:
      edited && step >= 2
        ? [
            {
              id: 'preview',
              start: 7,
              duration: 4.5,
              scale: zoom,
              x: 0.57,
              y: 0.62,
            },
          ]
        : [],
    captions: [],
  };
}
function OutputPreview({ ratio, theme }: { ratio: string; theme: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current)
      renderFrame(
        canvas.current,
        { ...demoProject(theme, true, 1, 1), ratio, padding: 95 },
        4,
      );
  }, [ratio, theme]);
  const [w, h] = ratio.split(':').map(Number);
  return (
    <canvas
      ref={canvas}
      width={Math.round((480 * w) / h)}
      height={480}
      role="img"
      aria-label={`Sample demo framed in ${ratio} format`}
    />
  );
}
function ScrollStory({ theme }: { theme: number }) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const trim = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const frameField = useRef<HTMLDivElement>(null);
  const focusField = useRef<HTMLDivElement>(null);
  const previewFrame = useRef<HTMLDivElement>(null);
  const focusRing = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const chapters = useRef<Array<HTMLElement | null>>([]);
  const words = useRef<Array<HTMLSpanElement | null>>([]);
  const chapterRef = useRef(0);
  const [chapter, setChapter] = useState(0);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, CustomEase);
    CustomEase.create('take-out', '0.23,1,0.32,1');
    CustomEase.create('take-in-out', '0.77,0,0.175,1');
    const mm = gsap.matchMedia();
    const paint = (value: number) => {
      const ease = gsap.parseEase('take-in-out');
      const portion = (start: number, end: number) =>
        ease(Math.max(0, Math.min(1, (value - start) / (end - start))));
      const cut = portion(0.04, 0.24),
        frame = portion(0.31, 0.51),
        focus = portion(0.64, 0.84);
      const nextChapter = value < 0.32 ? 0 : value < 0.66 ? 1 : 2;
      if (root.current) root.current.dataset.chapter = String(nextChapter);
      if (chapterRef.current !== nextChapter) {
        chapterRef.current = nextChapter;
        setChapter(nextChapter);
      }
      if (canvas.current)
        renderFrame(
          canvas.current,
          {
            ...demoProject(theme, true, 2, 1),
            padding: frame * 110,
            radius: frame * 16,
            shadow: frame * 45,
            zooms: [
              {
                id: 'scroll',
                start: 0,
                duration: 24,
                scale: 1 + focus * 0.55,
                x: 0.61,
                y: 0.53,
              },
            ],
          },
          4,
        );
      if (trim.current)
        trim.current.style.transform = `scaleX(${1 - cut * 0.25})`;
      if (progress.current)
        progress.current.style.transform = `scaleX(${value})`;
      if (frameField.current)
        frameField.current.style.clipPath = `circle(${frame * 148}% at 76% 52%)`;
      if (focusField.current)
        focusField.current.style.clipPath = `inset(${100 - focus * 100}% 0 0 0 round ${Math.round((1 - focus) * 36)}px ${Math.round((1 - focus) * 36)}px 0 0)`;
      if (previewFrame.current) {
        const scale = 1.03 - frame * 0.17 + focus * 0.17;
        previewFrame.current.style.transform = `translate3d(${-focus * 4.5}vw, ${(frame - focus) * 2.5}vh, 0) rotate(${frame * -1.8 + focus * 1.8}deg) scale(${scale})`;
      }
      if (focusRing.current) {
        focusRing.current.style.opacity = `${focus}`;
        focusRing.current.style.transform = `translate3d(${(1 - focus) * -90}px, ${(1 - focus) * 70}px, 0) scale(${0.82 + focus * 0.18})`;
      }
      if (cursor.current) {
        const railWidth = cursor.current.parentElement?.clientWidth ?? 0;
        cursor.current.style.transform = `translate3d(${value * railWidth}px, 0, 0)`;
      }

      chapters.current.forEach((element, index) => {
        if (!element) return;
        const start = index / 3;
        const end = (index + 1) / 3;
        const enter = index === 0 ? 1 : portion(start, start + 0.07);
        const exit = index === 2 ? 0 : portion(end - 0.07, end);
        element.style.opacity = `${enter * (1 - exit)}`;
        element.style.transform = `translate3d(0, ${(1 - enter) * 72 - exit * 52}px, 0)`;
      });
      words.current.forEach((element, index) => {
        if (!element) return;
        const start = index / 3;
        const end = (index + 1) / 3;
        const enter = index === 0 ? 1 : portion(start, start + 0.09);
        const exit = index === 2 ? 0 : portion(end - 0.09, end);
        element.style.opacity = `${0.08 * enter * (1 - exit)}`;
        element.style.transform = `translate3d(${(1 - enter) * 16 - exit * 12}vw, 0, 0)`;
      });
    };
    mm.add(
      {
        motion:
          '(prefers-reduced-motion: no-preference) and (min-width: 760px) and (min-height: 640px)',
        static:
          '(prefers-reduced-motion: reduce), (max-width: 759px), (max-height: 639px)',
      },
      (context) => {
        if (!root.current) return;
        if (!context.conditions?.motion) {
          root.current.removeAttribute('data-motion');
          if (canvas.current)
            renderFrame(canvas.current, demoProject(theme, true, 2, 1.55), 4);
          return;
        }
        root.current.setAttribute('data-motion', 'true');
        const state = { value: 0 };
        const animation = gsap.to(state, {
          value: 1,
          ease: 'none',
          onUpdate: () => paint(state.value),
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.3,
            invalidateOnRefresh: true,
          },
        });
        paint(animation.progress());
        return () => {
          root.current?.removeAttribute('data-motion');
        };
      },
    );
    return () => mm.revert();
  }, [theme]);
  return (
    <section
      ref={root}
      id="how-it-works"
      className="take-scroll-story"
      aria-label="How a recording becomes a demo"
    >
      <div className="take-story-sticky">
        <div className="take-story-fields" aria-hidden="true">
          <div className="take-story-field take-story-field-cut" />
          <div
            ref={frameField}
            className="take-story-field take-story-field-frame"
          />
          <div
            ref={focusField}
            className="take-story-field take-story-field-focus"
          />
        </div>
        <div className="take-story-rail" aria-hidden="true">
          <span ref={progress} />
          <i ref={cursor} />
        </div>
        <div className="take-story-heading">
          <span>ONE RECORDING · THREE EDITS</span>
          <span>0{chapter + 1} / 03</span>
        </div>
        <div className="take-story-layout">
          <div className="take-story-chapters">
            {steps.map((item, index) => (
              <article
                key={item.title}
                ref={(element) => {
                  chapters.current[index] = element;
                }}
                data-active={chapter === index}
              >
                <span className="take-story-number">0{index + 1}</span>
                <item.icon size={28} strokeWidth={1.5} aria-hidden="true" />
                <h2>{item.title}</h2>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <div className="take-story-preview">
            <div className="take-story-status">
              <span>orbit-demo.mp4</span>
              <span>
                {chapter === 0 ? 'TRIM' : chapter === 1 ? 'FRAME' : 'FOCUS'}
              </span>
            </div>
            <div ref={previewFrame} className="take-story-frame">
              <span className="take-story-corner take-story-corner-a" />
              <span className="take-story-corner take-story-corner-b" />
              <canvas
                ref={canvas}
                width={1120}
                height={700}
                role="img"
                aria-label={`Editing demonstration: ${steps[chapter].title}`}
              />
              <div
                ref={focusRing}
                className="take-story-focus"
                aria-hidden="true"
              >
                <Focus size={22} />
              </div>
            </div>
            <div
              className="take-story-timeline"
              aria-label="Trim the first and last three seconds"
            >
              <span>00:00</span>
              <div className="take-story-track">
                <div ref={trim} className="take-story-selection">
                  <i />
                  <span>orbit-demo</span>
                  <i />
                </div>
              </div>
              <span>00:24</span>
            </div>
          </div>
        </div>
        <div className="take-story-words" aria-hidden="true">
          {['CUT', 'FRAME', 'FOCUS'].map((word, index) => (
            <span
              key={word}
              ref={(element) => {
                words.current[index] = element;
              }}
            >
              {word}
            </span>
          ))}
        </div>
        <p className="take-story-hint">Scroll to direct the edit</p>
      </div>
    </section>
  );
}
export default function Landing() {
  const landingRoot = useRef<HTMLElement>(null);
  const heroRoot = useRef<HTMLElement>(null);
  const demoRoot = useRef<HTMLElement>(null);
  const bridgeRoot = useRef<HTMLElement>(null);
  const exportsRoot = useRef<HTMLElement>(null);
  const finaleRoot = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!location.hash) return;
    const timer = window.setTimeout(() => {
      ScrollTrigger.refresh();
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }, 180);
    return () => clearTimeout(timer);
  }, []);
  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger, CustomEase);
    CustomEase.create('take-out', '0.23,1,0.32,1');
    CustomEase.create('take-in-out', '0.77,0,0.175,1');
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (!landingRoot.current) return;
      const cinematic = matchMedia(
        '(min-width: 760px) and (min-height: 640px)',
      ).matches;
      gsap.set('.take-opening-mark > span', {
        transform: 'translate3d(0,100%,0)',
        opacity: 0,
      });
      gsap.set('.take-nav', { transform: 'translateY(-16px)', opacity: 0 });
      gsap.set('.take-intro', { transform: 'translateY(8px)', opacity: 0 });
      gsap.set('.take-hero-line > span', {
        transform: 'translateY(104%)',
      });
      gsap.set('.take-description, .take-hero .take-button, .take-note', {
        transform: 'translateY(12px)',
        opacity: 0,
      });
      gsap.set('.take-demo', {
        transform: 'translateY(24px) scale(0.97)',
        opacity: 0,
      });
      const entrance = gsap.timeline({
        defaults: { ease: 'take-out', duration: 0.6 },
      });
      entrance
        .to('.take-opening-mark > span', {
          transform: 'translate3d(0,0%,0)',
          opacity: 1,
          duration: 0.5,
          ease: 'take-out',
        })
        .to(
          '.take-opening',
          {
            clipPath: 'inset(0 0 100% 0)',
            duration: 0.72,
            ease: 'take-in-out',
          },
          0.56,
        )
        .to('.take-nav', { transform: 'translateY(0px)', opacity: 1 }, 0.78)
        .to('.take-intro', { transform: 'translateY(0px)', opacity: 1 }, 0.84)
        .to(
          '.take-hero-line > span',
          {
            transform: 'translateY(0%)',
            stagger: 0.08,
            duration: 0.82,
            ease: 'take-out',
          },
          0.88,
        )
        .to(
          '.take-description, .take-hero .take-button, .take-note',
          {
            transform: 'translateY(0px)',
            opacity: 1,
            stagger: 0.06,
            duration: 0.58,
          },
          1.08,
        )
        .to(
          '.take-demo',
          {
            transform: 'translateY(0px) scale(1)',
            opacity: 1,
            duration: 1,
          },
          1.18,
        );

      if (heroRoot.current) {
        gsap.to(heroRoot.current, {
          transform: 'translate3d(0,-9vh,0) scale(.94)',
          opacity: 0.12,
          ease: 'none',
          scrollTrigger: {
            trigger: heroRoot.current,
            start: 'top top',
            end: 'bottom 18%',
            scrub: 0.35,
          },
        });
      }
      if (demoRoot.current) {
        const demoPreview = demoRoot.current.querySelector('.take-preview');
        gsap.fromTo(
          demoRoot.current,
          {
            clipPath: 'inset(10% 4% 0% 4% round 34px)',
            transform: 'translate3d(0,7vh,0) scale(.94)',
          },
          {
            clipPath: 'inset(0% 0% 0% 0% round 12px)',
            transform: 'translate3d(0,0,0) scale(1)',
            ease: 'none',
            scrollTrigger: {
              trigger: demoRoot.current,
              start: 'top 94%',
              end: 'top 38%',
              scrub: 0.35,
            },
          },
        );
        if (demoPreview) {
          gsap.fromTo(
            demoPreview,
            { transform: 'scale(1.08)' },
            {
              transform: 'scale(1)',
              ease: 'none',
              scrollTrigger: {
                trigger: demoRoot.current,
                start: 'top 94%',
                end: 'top 38%',
                scrub: 0.35,
              },
            },
          );
        }
      }
      if (bridgeRoot.current && cinematic) {
        const bridgeWords = bridgeRoot.current.querySelectorAll(
          '.take-bridge-line > span',
        );
        const bridgeMark =
          bridgeRoot.current.querySelector('.take-bridge-disc');
        const bridge = gsap.timeline({
          scrollTrigger: {
            trigger: bridgeRoot.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.35,
          },
        });
        bridge
          .fromTo(
            bridgeWords,
            { transform: 'translate3d(0,112%,0)' },
            {
              transform: 'translate3d(0,0%,0)',
              stagger: 0.16,
              duration: 1,
              ease: 'take-in-out',
            },
          )
          .fromTo(
            bridgeMark,
            { transform: 'translate3d(-20vw,0,0) scale(.92)' },
            {
              transform: 'translate3d(20vw,0,0) scale(1)',
              duration: 1.4,
              ease: 'take-in-out',
            },
            0.3,
          );
      }

      if (finaleRoot.current) {
        const finale = gsap.timeline({
          scrollTrigger: {
            trigger: finaleRoot.current,
            start: 'top 88%',
            end: 'center center',
            scrub: 0.35,
          },
        });
        finale
          .fromTo(
            finaleRoot.current.querySelector('.take-finale-word'),
            { transform: 'translate3d(-10vw,0,0)', opacity: 0 },
            {
              transform: 'translate3d(0,0,0)',
              opacity: 1,
              duration: 1,
              ease: 'take-in-out',
            },
          )
          .fromTo(
            finaleRoot.current.querySelectorAll(
              '.take-finale-top > span, .take-finale-copy > *',
            ),
            { transform: 'translate3d(0,20px,0)', opacity: 0 },
            {
              transform: 'translate3d(0,0,0)',
              opacity: 1,
              stagger: 0.08,
              duration: 0.7,
              ease: 'take-out',
            },
            0.35,
          );
      }
    });
    return () => mm.revert();
  }, []);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, CustomEase);
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const root = exportsRoot.current;
      if (!root) return;
      const cards = Array.from(
        root.querySelectorAll<HTMLElement>('.take-format-stage figure'),
      );
      const desktop = matchMedia(
        '(min-width: 900px) and (min-height: 760px)',
      ).matches;
      // Keep the copy stationary while each output gets a separate scroll beat.
      if (desktop) root.setAttribute('data-pinned', 'true');
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: desktop ? 'top 80%' : 'top 75%',
          end: desktop ? 'bottom bottom' : 'bottom 85%',
          scrub: 0.3,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            root.dataset.format =
              self.progress < 0.46
                ? 'landscape'
                : self.progress < 0.73
                  ? 'square'
                  : 'portrait';
          },
        },
      });
      timeline.fromTo(
        root.querySelectorAll('.take-output-copy > *'),
        { transform: 'translate3d(0,36px,0)', opacity: 0 },
        {
          transform: 'translate3d(0,0,0)',
          opacity: 1,
          stagger: 0.08,
          duration: 0.7,
          ease: 'take-out',
        },
      );
      cards.forEach((card, index) => {
        timeline.fromTo(
          card,
          {
            transform: `translate3d(${desktop ? 36 : 12}vw, ${desktop ? 22 : 12}px, 0) rotate(${[4, 3, 2][index]}deg) scale(.94)`,
            opacity: 0,
          },
          {
            transform: 'translate3d(0,0,0) rotate(0deg) scale(1)',
            opacity: 1,
            duration: 0.8,
            ease: 'take-out',
          },
          0.55 + index * 1.05,
        );
        if (index < cards.length - 1) {
          timeline.to(
            card,
            {
              transform: 'translate3d(-14vw,-2vh,0) rotate(-3deg) scale(.84)',
              opacity: 0,
              duration: 0.75,
              ease: 'take-in-out',
            },
            1.25 + index * 1.05,
          );
        }
      });
      timeline.to({}, { duration: 0.3 });
      return () => root.removeAttribute('data-pinned');
    });
    // Rebuild the composition when its sticky layout breakpoint changes.
    const layout = matchMedia('(min-width: 900px) and (min-height: 760px)');
    const refresh = () => gsap.matchMediaRefresh();
    layout.addEventListener('change', refresh);
    return () => {
      layout.removeEventListener('change', refresh);
      mm.revert();
    };
  }, []);
  const [theme, setTheme] = useState(2),
    [zoom, setZoom] = useState(1.28);
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(true),
    [sequence, setSequence] = useState(true);
  const [reduced, setReduced] = useState(false),
    [showOriginal, setShowOriginal] = useState(false);
  const originalCanvas = useRef<HTMLCanvasElement>(null),
    editedCanvas = useRef<HTMLCanvasElement>(null),
    time = useRef(3),
    keyboard = useRef(false),
    zoomDragging = useRef(false);
  const paintState = useRef({
    padding: 0,
    radius: 0,
    shadow: 0,
    scale: 1,
  });
  const current = useRef({ theme, zoom, step });
  current.current = { theme, zoom, step };
  const paint = () => {
    if (!originalCanvas.current || !editedCanvas.current) return;
    const s = current.current,
      p = demoProject(s.theme, true, s.step, s.zoom),
      focus = p.zooms[0];
    renderFrame(
      editedCanvas.current,
      {
        ...p,
        padding: paintState.current.padding,
        radius: paintState.current.radius,
        shadow: paintState.current.shadow,
        zooms: focus ? [{ ...focus, scale: paintState.current.scale }] : [],
      },
      time.current,
    );
    renderFrame(
      originalCanvas.current,
      demoProject(s.theme, false, 0, 1),
      time.current,
    );
  };
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduced(media.matches);
      if (media.matches) {
        setPlaying(false);
        setSequence(false);
      }
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const target = demoProject(theme, true, step, zoom);
    const directManipulation = zoomDragging.current;
    const animation = gsap.to(paintState.current, {
      padding: target.padding,
      radius: target.radius,
      shadow: target.shadow,
      scale: target.zooms[0]?.scale ?? 1,
      duration:
        reduced || keyboard.current ? 0 : directManipulation ? 0.18 : 0.8,
      ease: directManipulation ? 'take-out' : 'take-in-out',
      overwrite: true,
      onUpdate: paint,
    });
    paint();
    return () => {
      animation.kill();
    };
  }, [theme, step, zoom, reduced]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0,
      last = 0;
    const tick = (now: number) => {
      if (!document.hidden && now - last >= 1000 / 60) {
        time.current += last ? Math.min((now - last) / 1000, 0.05) : 0;
        const start = 3;
        const end = 21;
        if (time.current > end || time.current < start) time.current = start;
        paint();
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  useEffect(() => {
    if (!sequence) return;
    const timer = window.setTimeout(() => {
      if (step < 2) {
        if (step === 1) time.current = 7;
        setStep(step + 1);
      } else {
        setSequence(false);
      }
    }, 2200);
    return () => clearTimeout(timer);
  }, [sequence, step]);
  return (
    <main
      ref={landingRoot}
      className="take-landing"
      onPointerDownCapture={() => {
        keyboard.current = false;
      }}
      onKeyDownCapture={() => {
        keyboard.current = true;
      }}
    >
      <div className="take-opening" aria-hidden="true">
        <div className="take-opening-mark">
          <span>
            <LogoMark className="take-opening-symbol" />
            take
          </span>
        </div>
      </div>
      <a className="take-skip" href="#demo">
        Skip to demo
      </a>
      <nav className="take-nav" aria-label="Main navigation">
        <a href="/" className="take-wordmark" aria-label="Take home">
          <LogoMark className="take-mark" />
          take
        </a>
        <div className="take-nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#exports">Export details</a>
        </div>
        <a className="take-nav-open" href="/editor">
          Open editor <ArrowUpRight size={16} />
        </a>
      </nav>
      <header ref={heroRoot} className="take-hero">
        <p className="take-intro">
          <Film size={15} /> A screen recording editor, in your browser.
        </p>
        <h1 aria-label="Your screen recording. Ready to share.">
          <span className="take-hero-line" aria-hidden="true">
            <span>Your screen recording.</span>
          </span>
          <span className="take-hero-line" aria-hidden="true">
            <span>Ready to share.</span>
          </span>
        </h1>
        <p className="take-description">
          Trim the pauses, frame your app, and zoom into what matters.
        </p>
        <a className="take-button" href="/editor">
          Open the editor <ArrowUpRight size={18} />
        </a>
        <p className="take-note">
          No account needed. Your files stay on your device.
        </p>
      </header>
      <section
        ref={demoRoot}
        className="take-demo"
        id="demo"
        aria-label="Interactive editing demo"
      >
        <div className="take-demo-bar">
          <span className="take-file">
            <Film size={15} /> orbit-demo{' '}
            <span className="take-sample-label">Sample</span>
          </span>
          <div className="take-compare-control">
            <span>Compare</span>
            <div
              className="take-compare-options"
              role="group"
              aria-label="Compare recording"
            >
              <button
                type="button"
                aria-pressed={showOriginal}
                onClick={() => setShowOriginal(true)}
              >
                Original
              </button>
              <button
                type="button"
                aria-pressed={!showOriginal}
                onClick={() => setShowOriginal(false)}
              >
                Edited
              </button>
            </div>
          </div>
        </div>
        <div className="take-preview">
          <canvas
            ref={originalCanvas}
            className="take-preview-original"
            width={1440}
            height={900}
            role="img"
            aria-label="Original Orbit screen recording"
          />
          <div
            className="take-preview-edited"
            data-visible={!showOriginal}
            aria-hidden="true"
          >
            <canvas ref={editedCanvas} width={1440} height={900} />
          </div>
          <span className="take-preview-label">
            {showOriginal
              ? 'Original'
              : sequence
                ? `${step + 1} / 3 · ${steps[step].title}`
                : 'Edited'}
          </span>
        </div>
        <div className="take-tools">
          <button
            className="take-play"
            aria-label={playing ? 'Pause demo' : 'Play demo'}
            onClick={() => {
              setSequence(false);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
            <span>{playing ? 'Pause' : 'Play'}</span>
          </button>
          <div className="take-backgrounds">
            <span>Background</span>
            {backdropIds.map((id) => (
              <button
                key={id}
                aria-label={`${themes[id].name} background`}
                aria-pressed={theme === id}
                style={{
                  backgroundImage: themes[id].image
                    ? `url(${themes[id].image})`
                    : `linear-gradient(135deg, ${themes[id].colors.join(',')})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                onClick={() => {
                  setSequence(false);
                  setTheme(id);
                  setStep(Math.max(1, step));
                }}
              >
                {theme === id && <Check size={13} />}
              </button>
            ))}
          </div>
          <label className="take-zoom">
            Zoom{' '}
            <input
              aria-label="Demo zoom"
              type="range"
              min="1"
              max="1.5"
              step=".01"
              value={zoom}
              onPointerDown={() => {
                zoomDragging.current = true;
              }}
              onPointerUp={() => {
                zoomDragging.current = false;
              }}
              onPointerCancel={() => {
                zoomDragging.current = false;
              }}
              onChange={(e) => {
                setSequence(false);
                time.current = 8.6;
                setZoom(Number(e.target.value));
                setStep(2);
              }}
            />
            <output>{zoom.toFixed(2)}×</output>
          </label>
        </div>
        <div className="take-timeline" aria-label="Trimmed sample timeline">
          <div className="take-ruler">
            <span>00:00</span>
            <span>00:06</span>
            <span>00:12</span>
            <span>00:18</span>
            <span>00:24</span>
          </div>
          <div className="take-track">
            <div className="take-trim" style={{ transform: 'scaleX(0.75)' }}>
              <span />
              <span />
            </div>
            <div className="take-track-label">
              <Film size={13} /> orbit-demo <span>00:03 to 00:21</span>
            </div>
          </div>
        </div>
        <div className="take-demo-foot">
          <span>
            Try the controls. This sample uses the editor’s rendering engine.
          </span>
          <a href="/editor">
            Use your own recording <ArrowUpRight size={14} />
          </a>
        </div>
      </section>
      <section
        ref={bridgeRoot}
        className="take-bridge"
        aria-label="From recording to finished demo"
      >
        <div className="take-bridge-sticky">
          <span className="take-bridge-kicker">THE EDIT BEGINS</span>
          <h2>
            <span className="take-bridge-line">
              <span>Keep the signal.</span>
            </span>
            <span className="take-bridge-line">
              <span>Lose the waiting.</span>
            </span>
          </h2>
          <div className="take-bridge-disc" aria-hidden="true">
            <Play size={24} fill="currentColor" />
          </div>
          <span className="take-bridge-caption">Recording in. Demo out.</span>
        </div>
      </section>
      <ScrollStory theme={theme} />
      <section
        ref={exportsRoot}
        className="take-export-story"
        id="exports"
        data-format="landscape"
        aria-label="One demo in three formats"
      >
        <div className="take-outputs">
          <div className="take-output-copy">
            <span className="take-section-label">THE FINAL FILE</span>
            <h2>
              Fits the feed.
              <br />
              Keeps the detail.
            </h2>
            <p>
              Landscape for a walkthrough. Portrait for a quick update. Square
              for everything in between.
            </p>
            <dl>
              <div>
                <dt>Resolution</dt>
                <dd>720p up to 4K</dd>
              </div>
              <div>
                <dt>Frame rate</dt>
                <dd>24, 30 or 60 fps</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>MP4 or WebM*</dd>
              </div>
            </dl>
            <p className="take-export-note">
              *MP4 where your browser supports it, WebM otherwise. Quality
              depends on your recording and device. Export runs in real time.
            </p>
          </div>
          <div className="take-format-panel">
            <div className="take-format-nav" aria-hidden="true">
              <span data-format="landscape">01 · Walkthrough</span>
              <span data-format="square">02 · Post</span>
              <span data-format="portrait">03 · Story</span>
            </div>
            <div className="take-format-stage">
              <figure className="take-landscape">
                <OutputPreview ratio="16:9" theme={theme} />
                <figcaption>
                  Walkthrough <span>16:9</span>
                </figcaption>
              </figure>
              <figure className="take-square">
                <OutputPreview ratio="1:1" theme={theme} />
                <figcaption>
                  Post <span>1:1</span>
                </figcaption>
              </figure>
              <figure className="take-portrait">
                <OutputPreview ratio="9:16" theme={theme} />
                <figcaption>
                  Story <span>9:16</span>
                </figcaption>
              </figure>
            </div>
            <p className="take-format-hint">One edit, shaped for the feed.</p>
          </div>
        </div>
      </section>
      <section
        ref={finaleRoot}
        className="take-finale"
        aria-labelledby="take-finale-title"
      >
        <div className="take-finale-top">
          <span>THE FIRST CUT STARTS HERE</span>
          <span>LOCAL BY DEFAULT</span>
        </div>
        <span className="take-finale-word" aria-hidden="true">
          take
        </span>
        <div className="take-finale-copy">
          <h2 id="take-finale-title">
            Bring the recording.
            <br />
            Leave with the demo.
          </h2>
          <p>No account. No upload queue. Your files stay on your device.</p>
          <a className="take-button" href="/editor">
            Open the editor <ArrowUpRight size={18} />
          </a>
        </div>
      </section>
      <footer className="take-colophon">
        <div className="take-colophon-brand">
          <a href="/" className="take-wordmark" aria-label="Take home">
            <LogoMark className="take-mark" />
            take
          </a>
          <p>A little editing. A better demo.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#demo">Try the demo</a>
          <a href="#exports">Export details</a>
          <a href="/editor">
            Open editor <ArrowUpRight size={14} />
          </a>
        </nav>
        <div className="take-colophon-bottom">
          <span>Screen recording, considered.</span>
          <a href="#">Back to top ↑</a>
        </div>
      </footer>
    </main>
  );
}
