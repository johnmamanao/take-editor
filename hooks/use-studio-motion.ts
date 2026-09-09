import { useEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

export function useStudioMotion(
  root: RefObject<HTMLElement | null>,
  tab: string,
) {
  const keyboard = useRef(false);
  useEffect(() => {
    gsap.registerPlugin(CustomEase);
    CustomEase.create('take-out', '0.23,1,0.32,1');
    const onKey = () => {
      keyboard.current = true;
      document.documentElement.dataset.input = 'keyboard';
    };
    const onPointer = () => {
      keyboard.current = false;
      document.documentElement.dataset.input = 'pointer';
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    const mm = gsap.matchMedia(root);
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({
        defaults: {
          ease: 'take-out',
          duration: 0.25,
          clearProps: 'transform,opacity',
        },
      });
      tl.from('.brand-mark', { rotation: -18, scale: 0.92, opacity: 0.5 })
        .from('.main-stage', { y: 6, opacity: 0.5 }, 0.04)
        .from('.timeline', { y: 5, opacity: 0.5 }, 0.08);
    });
    return () => {
      mm.revert();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
      delete document.documentElement.dataset.input;
    };
  }, [root]);
  useEffect(() => {
    if (keyboard.current) return;
    const mm = gsap.matchMedia(root);
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        '.inspector [data-slot="tabs-content"]:not([hidden])',
        { opacity: 0.7, transform: 'translateY(3px)' },
        {
          opacity: 1,
          transform: 'translateY(0px)',
          duration: 0.15,
          ease: 'take-out',
          overwrite: true,
          clearProps: 'opacity,transform',
        },
      );
    });
    return () => mm.revert();
  }, [root, tab]);
}
