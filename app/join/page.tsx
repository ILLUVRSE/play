'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { partyCodeSchema, displayNameSchema } from '@/lib/validation';

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const last = localStorage.getItem('illuvrse:lastName');
    if (last) setName(last);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCode = partyCodeSchema.safeParse(code.toUpperCase());
    const parsedName = displayNameSchema.safeParse(name);
    if (!parsedCode.success) {
      setError('Enter a valid 6-letter party code.');
      return;
    }
    if (!parsedName.success) {
      setError('Name must be 2-20 characters.');
      return;
    }
    localStorage.setItem('illuvrse:lastName', parsedName.data);
    localStorage.setItem(`party-${parsedCode.data}-name`, parsedName.data);
    router.push(`/party/${parsedCode.data}/seat`);
  };

  return (
    <div>
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        <div className="space-y-2">
          <p className="pill inline-block">Join a Party</p>
          <h1 className="text-3xl font-bold">Have a code? Drop it here.</h1>
          <p className="text-white/70">Seat selection is required. Your seat is your voice.</p>
        </div>
        <form onSubmit={submit} className="glass p-6 border-brand-primary/30 space-y-4 shadow-glow orbital">
          <label className="space-y-2">
            <span className="text-sm text-white/70">Party Code</span>
            <input
              className="w-full rounded-xl bg-black/40 border border-brand-primary/60 px-4 py-4 font-mono uppercase text-2xl tracking-[0.3em] text-center shadow-glow focus:outline-none focus:ring-2 focus:ring-brand-glow"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="B3Z9K4"
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-white/70">Display Name</span>
            <input
              className="w-full rounded-xl bg-black/40 border border-brand-primary/40 px-3 py-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              required
              placeholder="Your name"
            />
          </label>
          {error && <p className="text-red-300 text-sm">{error}</p>}
          <div className="flex gap-3 items-center">
            <button className="button-primary shadow-gold" type="submit">Pick your seat</button>
            <p className="text-white/60 text-sm">Row + Seat label follows you into chat.</p>
          </div>
        </form>
      </main>
    </div>
  );
}
