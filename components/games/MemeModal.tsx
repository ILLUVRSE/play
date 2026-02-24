'use client';

import { useState } from 'react';
import { getControlSettings } from '@/lib/controlSettings';

export function MemeModal({ onShare }: { onShare: (image: string) => void }) {
  const [idea, setIdea] = useState('');
  const [image, setImage] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const { openaiKey } = getControlSettings();
    const res = await fetch('/api/mememachine/generate_cached', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(openaiKey ? { 'x-openai-key': openaiKey } : {}) },
      body: JSON.stringify({ idea })
    });
    const data = await res.json();
    setLoading(false);
    if (data?.b64_png) setImage(`data:image/png;base64,${data.b64_png}`);
  };

  return (
    <div className="glass p-3 space-y-2">
      <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Meme idea" className="w-full bg-black/30 border border-white/20 rounded px-2 py-1" />
      <button onClick={generate} className="button-primary" disabled={loading}>{loading ? 'Generating...' : 'Generate Meme'}</button>
      {image ? <img src={image} alt="Generated meme" className="rounded border border-white/20" /> : null}
      {image ? <button onClick={() => onShare(image)} className="button-primary">Share to Party</button> : null}
    </div>
  );
}
