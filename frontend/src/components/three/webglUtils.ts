import React, { useEffect, useState } from 'react';

let cachedWebGLSupport: boolean | null = null;
let cachedIsSoftwareGL: boolean | null = null;

function probeWebGLOnce(): void {
  if (cachedWebGLSupport !== null) {
    return;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    cachedWebGLSupport = false;
    cachedIsSoftwareGL = true;
    return;
  }
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) {
    cachedWebGLSupport = false;
    cachedIsSoftwareGL = true;
    return;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!gl) {
      cachedWebGLSupport = false;
      cachedIsSoftwareGL = true;
      return;
    }
    cachedWebGLSupport = true;
    try {
      const ext = (gl as any).getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : (gl as any).RENDERER;
      const gpu = String((gl as any).getParameter(param) || '');
      cachedIsSoftwareGL = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      (gl as any).getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      cachedIsSoftwareGL = true;
    }
  } catch {
    cachedWebGLSupport = false;
    cachedIsSoftwareGL = true;
  }
}

export function isWebGLAvailable(): boolean {
  probeWebGLOnce();
  return Boolean(cachedWebGLSupport);
}

export function isSoftwareWebGL(): boolean {
  probeWebGLOnce();
  return Boolean(cachedIsSoftwareGL);
}

export function useReducedMotionPreference(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  return reduced;
}

interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class WebGLErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
