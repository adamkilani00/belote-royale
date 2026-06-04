'use client';

import { useEffect, useState } from 'react';

const REACTUS_ORIGIN = (process.env.REACTUS_BASE_URL ?? '').replace(/\/$/, '');
const WATERMARK_API_BASE = REACTUS_ORIGIN
  ? `${REACTUS_ORIGIN}/v1/project`
  : '';
const EDIT_APP_URL = 'https://happyseeds.ai/';
const HAPPYSEEDS_LOGO_URL = 'https://happyseeds.ai/logo.svg';

function watermarkResponseVisible(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const envelope = payload as { success?: unknown; data?: unknown };
  if (envelope.success !== true) return false;
  const data = envelope.data;
  if (!data || typeof data !== 'object') return false;
  return (data as { show_watermark?: unknown }).show_watermark === true;
}

export function HappySeedsWatermark() {
  const [ready, setReady] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      /* 跨域父页面等场景下视作嵌入 */
      setIsIframe(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || isIframe) return;
    const projectId = typeof process.env.PROJECT_ID === 'string'
      ? process.env.PROJECT_ID.trim()
      : '';
    if (!projectId || !WATERMARK_API_BASE) return;

    let cancelled = false;
    (async () => {
      try {
        const url = `${WATERMARK_API_BASE}/${projectId}/watermark`;
        const res = await fetch(url);
        const payload: unknown = await res.json().catch(() => null);
        if (!cancelled && watermarkResponseVisible(payload)) setVisible(true);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, isIframe]);

  if (!ready || isIframe || !visible) return null;

  return (
    <div className="pointer-events-auto fixed right-6 bottom-6 z-50 font-sans">
      <div className="flex items-stretch overflow-hidden rounded-full border border-neutral-200 bg-white shadow-sm">
        <a
          href={EDIT_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-600 no-underline hover:bg-neutral-50"
        >
          <span className="text-neutral-500">Edit with</span>
          <img
            src={HAPPYSEEDS_LOGO_URL}
            alt=""
            width={20}
            height={20}
            className="size-5 shrink-0"
          />
          <span className="font-medium text-neutral-900">HappySeeds</span>
        </a>
      </div>
    </div>
  );
}
