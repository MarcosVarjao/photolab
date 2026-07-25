import { useCallback, useRef, useState } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface DropzoneProps {
  onFile: (file: File) => void;
}

export default function Dropzone({ onFile }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith('image/')) return;
      onFile(file);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`group relative cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300 ${
        dragging
          ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
          : 'border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/[0.07]'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-2xl bg-cyan-500/20 blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-40" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-white/10">
            {dragging ? (
              <ImageIcon className="h-9 w-9 text-cyan-300" strokeWidth={1.5} />
            ) : (
              <Upload className="h-9 w-9 text-cyan-300" strokeWidth={1.5} />
            )}
          </div>
        </div>
        <h3 className="text-lg font-medium text-white">
          {dragging ? 'Solte sua imagem aqui' : 'Arraste uma imagem ou clique para enviar'}
        </h3>
        <p className="mt-2 text-sm text-white/50">
          JPG, PNG ou WebP — processada direto no seu navegador
        </p>
      </div>
    </div>
  );
}
