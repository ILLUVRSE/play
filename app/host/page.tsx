'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Header } from '@/components/Header';
import { detectContentType } from '@/lib/validation';

export default function HostPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    contentUrl: '',
    visibility: 'private',
    maxSeats: 24,
    theme: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!detectContentType(form.contentUrl)) {
      setError('Content must be a valid YouTube, MP3, or MP4 link');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/parties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      const errorText =
        typeof data.error === 'string' ? data.error : data.error?._errors?.[0] || 'Unable to create party';
      setError(errorText);
      return;
    }
    const data = await res.json();
    localStorage.setItem(`party-${data.code}-host`, 'true');
    if (data.participantId) {
      localStorage.setItem(`party-${data.code}-participant`, data.participantId);
      localStorage.setItem(`party-${data.code}-seat`, data.hostSeat);
      localStorage.setItem(`party-${data.code}-name`, 'Host');
    }
    router.push(`/party/${data.code}/host`);
  };

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <p className="pill inline-block">Host a Party</p>
          <h1 className="text-3xl font-bold">Set the ritual. Drop the code.</h1>
          <p className="text-white/70">Name the night, paste the media link, choose seats. Your code is the invite.</p>
        </div>

        <form onSubmit={submit} className="glass p-6 border-brand-primary/30 space-y-4 shadow-glow orbital">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm text-white/70">Party name</span>
              <input
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                required
                className="w-full rounded-xl bg-black/30 border border-brand-primary/40 px-3 py-3 focus:outline-none focus:ring-2 focus:ring-brand-glow"
                placeholder="Midnight Cult Classics"
              />
            </label>
            <label className="space-y-2">
            <span className="text-sm text-white/70">Media link (YouTube, MP3, or MP4)</span>
              <input
                value={form.contentUrl}
                onChange={(e) => update('contentUrl', e.target.value)}
                required
                className="w-full rounded-xl bg-black/30 border border-brand-primary/40 px-3 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-brand-glow"
                placeholder="https://youtube.com/watch?v=... or https://example.com/video.mp4"
              />
            </label>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="space-y-2">
              <span className="text-sm text-white/70">Visibility</span>
              <select
                value={form.visibility}
                onChange={(e) => update('visibility', e.target.value)}
                className="w-full rounded-xl bg-black/30 border border-brand-primary/40 px-3 py-3"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white/70">Seat count</span>
              <select
                value={form.maxSeats}
                onChange={(e) => update('maxSeats', Number(e.target.value))}
                className="w-full rounded-xl bg-black/30 border border-brand-primary/40 px-3 py-3"
              >
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white/70">Theme (optional)</span>
              <input
                value={form.theme}
                onChange={(e) => update('theme', e.target.value)}
                className="w-full rounded-xl bg-black/30 border border-brand-primary/40 px-3 py-3"
                placeholder="Cult horror, Karaoke, Retro..."
              />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/70">
              Code preview <span className="font-mono text-brand-glow">XXXXXX</span> (generated on submit)
            </div>
            <button className="button-primary shadow-gold" type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Generate Party Code'}
            </button>
          </div>
          {error && <p className="text-red-300 text-sm">{error}</p>}
        </form>
      </main>
    </div>
  );
}
