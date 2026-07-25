import { useCallback, useEffect, useRef, useState } from 'react';
import { Wand2, Loader2, AlertCircle } from 'lucide-react';
import Dropzone from '@/components/Dropzone';
import Toolbar, { type EffectId } from '@/components/Toolbar';
import {
  applySketch,
  enhanceImage,
  removeBackgroundFromImage,
  wideAngleEffect,
  type SketchStyle,
} from '@/utils/imageProcessing';

interface HistoryEntry {
  dataUrl: string;
  effect: EffectId;
  sketch: SketchStyle | null;
}

export default function App() {
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeEffect, setActiveEffect] = useState<EffectId>('original');
  const [activeSketch, setActiveSketch] = useState<SketchStyle | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checker, setChecker] = useState(false);

  const current = history.length > 0 ? history[history.length - 1] : null;
  const displaySrc = current?.dataUrl ?? originalSrc;

  const previewRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setChecker(activeEffect === 'remove-bg');
  }, [activeEffect]);

  const handleFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setOriginalSrc(src);
      setHistory([{ dataUrl: src, effect: 'original', sketch: null }]);
      setActiveEffect('original');
      setActiveSketch(null);
    };
    reader.onerror = () => setError('Não foi possível ler o arquivo.');
    reader.readAsDataURL(file);
  }, []);

  const apply = useCallback(
    async (effect: EffectId, sketch: SketchStyle | null) => {
      if (!originalSrc) return;
      setBusy(true);
      setError(null);
      setStatusMsg('Processando…');
      try {
        let result: string;
        if (effect === 'original') {
          result = originalSrc;
        } else if (effect === 'enhance') {
          setStatusMsg('Melhorando a qualidade…');
          result = await enhanceImage(originalSrc);
        } else if (effect === 'remove-bg') {
          setStatusMsg('Removendo o fundo…');
          result = await removeBackgroundFromImage(originalSrc);
        } else if (effect === 'wide-angle') {
          setStatusMsg('Aplicando grande angular…');
          result = await wideAngleEffect(originalSrc);
        } else if (effect === 'sketch' && sketch) {
          setStatusMsg('Transformando em desenho…');
          result = await applySketch(originalSrc, sketch);
        } else {
          result = originalSrc;
        }
        setHistory([{ dataUrl: result, effect, sketch }]);
        setActiveEffect(effect);
        setActiveSketch(sketch);
      } catch (e) {
        console.error(e);
        setError(
          effect === 'remove-bg'
            ? 'Falha ao remover o fundo. Tente outra imagem.'
            : 'Algo deu errado ao processar a imagem.',
        );
      } finally {
        setBusy(false);
        setStatusMsg('');
      }
    },
    [originalSrc],
  );

  const handleEffect = (effect: EffectId) => apply(effect, null);
  const handleSketch = (style: SketchStyle) => apply('sketch', style);
  const handleReset = () => apply('original', null);

  const handleDownload = () => {
    if (!displaySrc) return;
    const a = document.createElement('a');
    const suffix =
      activeEffect === 'sketch' && activeSketch
        ? `sketch-${activeSketch}`
        : activeEffect;
    a.href = displaySrc;
    a.download = `imagem-${suffix}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-[#0a0d16] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative">
        <header className="border-b border-white/5 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/20">
                <Wand2 className="h-5 w-5 text-white" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight">PhotoLab</h1>
                <p className="text-xs text-white/40">Edição de imagens no navegador</p>
              </div>
            </div>
            <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 sm:inline-block">
              100% local · privado
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-10">
          {!originalSrc ? (
            <div className="mx-auto max-w-3xl">
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Edite suas imagens com{' '}
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    um clique
                  </span>
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-white/50">
                  Remoção de fundo com IA, melhoria de qualidade, efeito grande angular e
                  desenho a lápis — tudo no seu navegador, sem upload para servidores.
                </p>
              </div>
              <Dropzone onFile={handleFile} />
              {error && (
                <p className="mt-4 flex items-center justify-center gap-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4" /> {error}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
              <div className="flex flex-col gap-4">
                <div className="relative flex min-h-[50vh] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  {checker && (
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{
                        backgroundImage:
                          'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
                        backgroundSize: '24px 24px',
                        backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
                      }}
                    />
                  )}
                  {busy && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-sm">
                      <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                      <p className="text-sm text-white/70">{statusMsg}</p>
                    </div>
                  )}
                  <img
                    ref={previewRef}
                    src={displaySrc ?? undefined}
                    alt="Pré-visualização"
                    className="relative max-h-[60vh] max-w-full rounded-lg object-contain shadow-2xl"
                  />
                </div>

                {error && (
                  <p className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                  </p>
                )}
              </div>

              <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <Toolbar
                    activeEffect={activeEffect}
                    activeSketch={activeSketch}
                    busy={busy}
                    hasResult={!!displaySrc}
                    onEffect={handleEffect}
                    onSketch={handleSketch}
                    onReset={handleReset}
                    onDownload={handleDownload}
                  />
                </div>
                <button
                  onClick={() => {
                    setOriginalSrc(null);
                    setHistory([]);
                    setActiveEffect('original');
                    setActiveSketch(null);
                    setError(null);
                  }}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-white/50 transition hover:bg-white/[0.06] hover:text-white/80"
                >
                  Escolher outra imagem
                </button>
              </aside>
            </div>
          )}
        </main>

        <footer className="border-t border-white/5 py-6 text-center text-xs text-white/30">
          Processado localmente · suas imagens não saem do seu dispositivo
        </footer>
      </div>
    </div>
  );
}
