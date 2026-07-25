# PhotoLab

App de edição de imagens que roda 100% no navegador — suas imagens nunca saem do seu dispositivo.

## Recursos

- **Remoção de fundo com IA** — remove o fundo automaticamente
- **Melhoria de qualidade** — aumenta nitidez, contraste e saturação
- **Efeito grande angular** — simula foto de câmera profissional com distorção de barril e vinheta
- **Desenho a lápis** — 5 estilos que substituem (não empilham) ao clicar:
  - Classic Pencil
  - Rough Sketch
  - Fine Line
  - Soft Pencil
  - Architectural

Cada efeito é aplicado sobre a imagem original, então clicar em outro sempre substitui o anterior.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- `@imgly/background-removal` (IA no navegador via ONNX)
- Canvas 2D para processamento de imagem

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
