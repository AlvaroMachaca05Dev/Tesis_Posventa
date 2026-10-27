import '@testing-library/jest-dom/vitest';

// jsdom no trae matchMedia: por defecto simula una pantalla de escritorio.
if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
}
