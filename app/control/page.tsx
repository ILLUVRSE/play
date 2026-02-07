import { Header } from '@/components/Header';
import { ControlPanel } from '@/components/control/ControlPanel';

const controlEnabled = process.env.CONTROL_ENABLED === 'true' || process.env.NODE_ENV === 'development';

export default function ControlPage() {
  return (
    <div>
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        <div className="space-y-2">
          <p className="pill inline-block">Owner</p>
          <h1 className="text-3xl font-bold">Control</h1>
          <p className="text-white/70">Configure MemeMachine defaults. Keys stay on this device.</p>
        </div>
        <ControlPanel enabled={controlEnabled} />
      </main>
    </div>
  );
}
