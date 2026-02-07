'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import { generateMeme, MemeResponse } from '@/lib/mememachine';
import { ControlSettings, getControlSettings } from '@/lib/controlSettings';

type Props = {
  compact?: boolean;
  onGenerated?: (img: MemeResponse) => void;
};

const styles = ['clean', 'retro', 'vaporwave', 'film grain', 'minimalist'];
const aspects: Array<{ label: string; value: '1:1' | '4:5' | '16:9' }> = [
  { label: 'Square 1:1', value: '1:1' },
  { label: 'Portrait 4:5', value: '4:5' },
  { label: 'Landscape 16:9', value: '16:9' }
];

export function MemeMachinePanel({ compact, onGenerated }: Props) {
  const [idea, setIdea] = useState('');
  const [topText, setTopText] = useState('');
  const [bottomText, setBottomText] = useState('');
  const [style, setStyle] = useState('clean');
  const [aspect, setAspect] = useState<'1:1' | '4:5' | '16:9'>('1:1');
  const [mode, setMode] = useState<'image' | 'gif'>('image');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState<MemeResponse | null>(null);
  const [settings, setSettings] = useState<ControlSettings | null>(null);
  const [quality, setQuality] = useState<'standard' | 'high'>('standard');

  useEffect(() => {
    const s = getControlSettings();
    setSettings(s);
    setStyle(s.defaultStyle);
    setAspect(s.defaultAspect);
    setMode(s.defaultMode);
    setQuality(s.defaultQuality);
  }, []);

  const generate = async () => {
    setError('');
    if (!idea.trim()) {
      setError('Meme idea required');
      return;
    }
    if (settings?.clientCooldownEnabled) {
      const now = Date.now();
      const last = Number(localStorage.getItem('mememachine:lastGen') || '0');
      const diff = (now - last) / 1000;
      if (diff < settings.minSecondsBetweenGenerations) {
        setError(`Cooldown: wait ${Math.ceil(settings.minSecondsBetweenGenerations - diff)}s`);
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const dailyRaw = localStorage.getItem('mememachine:daily');
      let daily = { date: today, count: 0 };
      if (dailyRaw) {
        try {
          daily = JSON.parse(dailyRaw);
        } catch {
          daily = { date: today, count: 0 };
        }
      }
      if (daily.date !== today) {
        daily = { date: today, count: 0 };
      }
      if (daily.count >= settings.maxDailyGenerations) {
        setError('Daily generation limit reached');
        return;
      }
      daily.count += 1;
      localStorage.setItem('mememachine:daily', JSON.stringify(daily));
      localStorage.setItem('mememachine:lastGen', String(now));
    }
    setLoading(true);
    try {
      const res = await generateMeme({ idea, topText, bottomText, style, aspect, mode }, settings?.openaiKey);
      setImage(res);
      onGenerated?.(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!image?.b64_png) return;
    const byteString = atob(image.b64_png);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'illuvrse-meme.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setError('');
  }, [idea, topText, bottomText, style, aspect, mode, quality]);

  return (
    <div className={`grid ${compact ? 'md:grid-cols-2' : 'lg:grid-cols-2'} gap-6`}>
      <div className="glass p-5 border-brand-primary/30 shadow-glow space-y-3 orbital">
        <div className="flex items-center justify-between">
          <div>
            <p className="pill inline-block">MemeMachine</p>
            <h3 className="text-xl font-semibold">Turn any idea into a meme</h3>
          </div>
          <div className="text-xs text-white/60 px-3 py-1 rounded-full border border-white/10 bg-white/5">
            GIF mode (coming soon)
          </div>
        </div>
        <label className="space-y-1">
          <span className="text-sm text-white/70">Meme Idea</span>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-brand-primary/40 px-3 py-3 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-brand-glow"
            placeholder="e.g., cat hosting a late-night talk show about cheese"
          />
        </label>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-sm text-white/70">Top text</span>
            <input
              value={topText}
              onChange={(e) => setTopText(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-brand-primary/40 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-glow"
              maxLength={80}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-white/70">Bottom text</span>
            <input
              value={bottomText}
              onChange={(e) => setBottomText(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-brand-primary/40 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-glow"
              maxLength={80}
            />
          </label>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-sm text-white/70">Style</span>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-brand-primary/40 px-3 py-3"
            >
              {styles.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-white/70">Quality</span>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as 'standard' | 'high')}
              className="w-full rounded-xl bg-black/40 border border-brand-primary/40 px-3 py-3"
            >
              <option value="standard">Standard</option>
              <option value="high">High (preference)</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-white/70">Mode</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'image' | 'gif')}
              className="w-full rounded-xl bg-black/40 border border-brand-primary/40 px-3 py-3"
            >
              <option value="image">Image</option>
              <option value="gif" disabled>
                GIF (coming soon)
              </option>
            </select>
          </label>
          <div className="space-y-2">
            <span className="text-sm text-white/70">Aspect ratio</span>
            <div className="flex flex-wrap gap-2">
              {aspects.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAspect(a.value)}
                  className={`px-3 py-2 rounded-xl border text-sm ${
                    aspect === a.value
                      ? 'border-brand-glow bg-brand-glow/10 shadow-glow'
                      : 'border-brand-primary/30 bg-black/30'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && <p className="text-red-300 text-sm">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            className="button-primary shadow-gold"
            onClick={generate}
            disabled={loading}
          >
            {loading ? 'Summoning...' : 'Generate Meme'}
          </button>
          <button
            type="button"
            className="button-ghost border-brand-primary/40"
            onClick={() => setIdea('')}
          >
            Clear
          </button>
          <button
            type="button"
            className="button-ghost border-brand-primary/40"
            onClick={() => {
              const s = getControlSettings();
              setSettings(s);
              setStyle(s.defaultStyle);
              setAspect(s.defaultAspect);
              setQuality(s.defaultQuality);
              setMode(s.defaultMode);
            }}
          >
            Use defaults
          </button>
        </div>
      </div>

      <div className="glass p-5 border-brand-primary/30 shadow-glow space-y-3 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-30 orbital" />
        <div className="flex items-center justify-between relative">
          <div>
            <p className="text-sm text-white/70">Preview</p>
            <p className="text-xs text-white/50">Don’t upload private info. Don’t impersonate real people.</p>
          </div>
          <div className="text-xs text-brand-glow font-semibold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand-glow animate-pulse" /> LIVE
          </div>
        </div>
        <div className="relative bg-black/50 border border-brand-primary/30 rounded-2xl min-h-[260px] grid place-items-center overflow-hidden">
          {loading && <div className="animate-pulse text-white/50">Generating...</div>}
          {!loading && image?.b64_png && (
            <img
              src={`data:image/png;base64,${image.b64_png}`}
              alt="Generated meme"
              className="w-full h-full object-contain"
            />
          )}
          {!loading && !image?.b64_png && <div className="text-white/50 text-sm">Your meme appears here.</div>}
        </div>
        <div className="flex gap-3 relative">
          <button
            type="button"
            className="button-ghost border-brand-primary/40"
            onClick={generate}
            disabled={loading}
          >
            Regenerate
          </button>
          <button
            type="button"
            className="button-ghost border-brand-primary/40"
            onClick={download}
            disabled={!image?.b64_png}
          >
            Download PNG
          </button>
        </div>
      </div>
    </div>
  );
}
