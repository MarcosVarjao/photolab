import {
  Sparkles,
  Scissors,
  Camera,
  Pencil,
  Download,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { SKETCH_STYLES, type SketchStyle } from '@/utils/imageProcessing';

export type EffectId = 'original' | 'enhance' | 'remove-bg' | 'wide-angle' | 'sketch';

interface ToolbarProps {
  activeEffect: EffectId;
  activeSketch: SketchStyle | null;
  busy: boolean;
  hasResult: boolean;
  onEffect: (effect: EffectId) => void;
  onSketch: (style: SketchStyle) => void;
  onReset: () => void;
  onDownload: () => void;
}

export default function Toolbar({
  activeEffect,
  activeSketch,
  busy,
  hasResult,
  onEffect,
  onSketch,
  onReset,
  onDownload,
}: ToolbarProps) {
  const btnBase =
    'group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed';
  const btnIdle = 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20';
  const btnActive = 'border-cyan-400/60 bg-cyan-500/15 shadow-[0_0_20px_-5px] shadow-cyan-500/40';

  const mainButtons: { id: EffectId; label: string; desc: string; icon: typeof Sparkles }[] = [
    { id: 'original', label: 'Original', desc: 'Imagem sem efeitos', icon: RotateCcw },
    { id: 'enhance', label: 'Melhorar qualidade', desc: 'Nitidez, contraste e cor', icon: Sparkles },
    { id: 'remove-bg', label: 'Remover fundo', desc: 'IA remove o fundo', icon: Scissors },
    { id: 'wide-angle', label: 'Grande angular', desc: 'Estilo câmera profissional', icon: Camera },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Efeitos principais
        </h3>
        <div className="grid grid-cols-1 gap-2.5">
          {mainButtons.map((b) => {
            const Icon = b.icon;
            const isActive = activeEffect === b.id;
            const isSketchInactive = activeEffect === 'sketch';
            return (
              <button
                key={b.id}
                disabled={busy || !hasResult}
                onClick={() => onEffect(b.id)}
                className={`${btnBase} ${isActive && !isSketchInactive ? btnActive : btnIdle}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isActive && !isSketchInactive
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-white/5 text-white/70 group-hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-white">{b.label}</span>
                  <span className="text-xs text-white/45">{b.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          Desenho a lápis
        </h3>
        <div className="grid grid-cols-1 gap-2.5">
          {SKETCH_STYLES.map((s) => {
            const isActive = activeEffect === 'sketch' && activeSketch === s.id;
            return (
              <button
                key={s.id}
                disabled={busy || !hasResult}
                onClick={() => onSketch(s.id)}
                className={`${btnBase} ${isActive ? btnActive : btnIdle}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-white/5 text-white/70 group-hover:text-white'
                  }`}
                >
                  <Pencil className="h-5 w-5" strokeWidth={1.7} />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-white">{s.label}</span>
                  <span className="text-xs text-white/45">{s.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2.5 border-t border-white/10 pt-5">
        <button
          disabled={!hasResult || busy}
          onClick={onDownload}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy ? 'Processando…' : 'Baixar imagem'}
        </button>
        <button
          disabled={!hasResult || busy}
          onClick={onReset}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/70 transition-all hover:bg-white/[0.07] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Voltar ao original
        </button>
      </div>
    </div>
  );
}
