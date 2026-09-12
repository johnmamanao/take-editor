import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

export function useStudioMotion(
  root: RefObject<HTMLElement | null>,
  tab: string,
) {
  const keyboard = useRef(false);
  useLayoutEffect(() => {
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
      tl.from('.editor-brand-mark', {
        transform: 'rotate(-8deg) scale(0.94)',
        opacity: 0.5,
      })
        .from(
          '.inspector',
          { transform: 'translate3d(-6px,0,0)', opacity: 0.5 },
          0.02,
        )
        .from(
          '.main-stage',
          { transform: 'translate3d(0,6px,0)', opacity: 0.5 },
          0.04,
        )
        .from(
          '.timeline',
          { transform: 'translate3d(0,5px,0)', opacity: 0.5 },
          0.08,
        );
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
