'use client';

import { useEffect } from 'react';

/**
 * Scroll-triggered animation hook.
 * Observes all elements with [data-animate] and adds 'visible' class
 * when they enter the viewport. Supports staggered delays.
 *
 * Usage: Call useScrollAnimation() in any client component's parent.
 * Add data-animate to elements: <div data-animate>...</div>
 * Or with variants: <div data-animate="scale">...</div>
 */
export function useScrollAnimation() {
  useEffect(() => {
    const elements = document.querySelectorAll('[data-animate]');
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Apply stagger delay if parent has stagger-children or element has data-delay
            const delay = (entry.target as HTMLElement).dataset.delay;
            if (delay) {
              setTimeout(() => {
                entry.target.classList.add('visible');
              }, parseInt(delay, 10));
            } else {
              entry.target.classList.add('visible');
            }
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}
