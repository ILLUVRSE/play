'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function InlineJoin() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextCode = code.trim().toUpperCase();
    if (nextCode.length === 6) {
      router.push(`/party/${nextCode}/seat`);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-3">
      <input
        className="flex-1 min-w-[180px] rounded-xl bg-black/40 border border-brand-primary/50 px-3 py-3 font-mono uppercase text-lg shadow-glow focus:outline-none focus:ring-2 focus:ring-brand-glow"
        placeholder="B3Z9K4"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />
      <button type="submit" className="button-primary text-base">Join</button>
    </form>
  );
}
