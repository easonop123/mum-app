import { useEffect, useState } from 'react';

// Tiny hash router: works from any static HTTPS host or sub-path without
// server rewrites. Route data never contains personal or health values.

export interface Route {
  path: string;
  segments: string[];
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const path = raw.split('?')[0] || '/';
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return { path: normalised, segments: normalised.split('/').filter(Boolean) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string, options: { replace?: boolean } = {}): void {
  const target = `#${path}`;
  if (window.location.hash === target) return;
  if (options.replace) {
    window.location.replace(target);
  } else {
    window.location.hash = path;
  }
}

export function href(path: string): string {
  return `#${path}`;
}

export const WORKOUT_ROUTES = ['/session'] as const;
export const LEARNING_ROUTES = ['/learn', '/plan'] as const;
