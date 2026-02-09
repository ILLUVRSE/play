'use client';

import { useEffect, useState } from 'react';
import { ControlSettings, getControlSettings, setControlSettings, clearOpenAIKey } from '@/lib/controlSettings';

export function ControlPanel({ enabled }: { enabled: boolean }) {
  const [settings, setSettingsState] = useState<ControlSettings>(getControlSettings());
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState('No key set');

  useEffect(() => {
    const s = getControlSettings();
    setSettingsState(s);
    setStatus(s.openaiKey ? 'Key saved locally on this device' : 'No key set');
  }, []);

  const save = () => {
    setControlSettings(settings);
    setStatus(settings.openaiKey ? 'Key saved locally on this device' : 'No key set');
  };

  const clearKey = () => {
    clearOpenAIKey();
    const s = getControlSettings();
    setSettingsState(s);
    setStatus('No key set');
  };

  if (!enabled) {
    return (
      <div className="glass p-6 border-brand-primary/30 shadow-glow space-y-2">
        <h2 className="text-xl font-semibold">Control</h2>
        <p className="text-white/70">Controls are locked. Set CONTROL_ENABLED=true or run in development.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="glass p-6 border-brand-primary/30 shadow-glow space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">OpenAI Key</h2>
            <p className="text-sm text-white/70">For safety, this key is stored only in your browser (localStorage).</p>
          </div>
          <span className="pill">{status}</span>
        </div>
        <label className="space-y-2">
          <span className="text-sm text-white/70">OpenAI API Key</span>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={settings.openaiKey || ''}
              onChange={(e) => setSettingsState({ ...settings, openaiKey: e.target.value })}
              className="flex-1 rounded-xl bg-black/40 border border-brand-primary/40 px-3 py-3"
              placeholder="sk-..."
            />
            <button type="button" className="button-ghost border-brand-primary/40" onClick={() => setShowKey((v) => !v)}>
              {showKey ? 'Hide' : 'Reveal'}
            </button>
          </div>
        </label>
        <div className="flex gap-3">
          <button className="button-primary shadow-gold" type="button" onClick={save}>
            Save
          </button>
          <button className="button-ghost border-brand-primary/40" type="button" onClick={clearKey}>
            Clear key
          </button>
        </div>
        <ul className="text-xs text-white/60 list-disc ml-5 space-y-1">
          <li>For safety, this key is stored only in your browser (localStorage).</li>
          <li>Do not use a key with broad permissions.</li>
        </ul>
      </section>

      {/* MemeMachine defaults removed */}

      <section className="glass p-6 border-brand-primary/30 shadow-glow space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Rate Limits / Safety</h2>
          <span className="pill text-xs">Client-side only</span>
        </div>
        <label className="flex items-center gap-3 text-sm text-white/80">
          <input
            type="checkbox"
            checked={settings.clientCooldownEnabled}
            onChange={(e) => setSettingsState({ ...settings, clientCooldownEnabled: e.target.checked })}
            className="accent-brand-primary"
          />
          Enable client-side cooldown
        </label>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-sm text-white/70">Min seconds between generations</span>
            <input
              type="number"
              min={0}
              value={settings.minSecondsBetweenGenerations}
              onChange={(e) => setSettingsState({ ...settings, minSecondsBetweenGenerations: Number(e.target.value) })}
              className="w-full rounded-xl bg-black/40 border border-brand-primary/40 px-3 py-3"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-white/70">Max daily generations</span>
            <input
              type="number"
              min={1}
              value={settings.maxDailyGenerations}
              onChange={(e) => setSettingsState({ ...settings, maxDailyGenerations: Number(e.target.value) })}
              className="w-full rounded-xl bg-black/40 border border-brand-primary/40 px-3 py-3"
            />
          </label>
        </div>
        <div className="flex gap-3">
          <button className="button-primary shadow-gold" type="button" onClick={save}>
            Save settings
          </button>
          <button className="button-ghost border-brand-primary/40" type="button" onClick={() => setSettingsState(getControlSettings())}>
            Reset to stored
          </button>
        </div>
      </section>
    </div>
  );
}
