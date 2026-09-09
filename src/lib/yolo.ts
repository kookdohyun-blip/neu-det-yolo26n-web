"use client";

import { INPUT_SIZE, MODEL_URL, SCORE_KEEP } from "./classes";

export type Detection = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
  cls: number;
};

export type LetterboxInfo = {
  tensor: Float32Array;
  scale: number;
  padX: number;
  padY: number;
  origW: number;
  origH: number;
};

type OrtModule = typeof import("onnxruntime-web/wasm");
type Session = import("onnxruntime-web/wasm").InferenceSession;

let ortModule: OrtModule | null = null;
let sessionPromise: Promise<Session> | null = null;

function clamp(value: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, value));
}

export function letterboxImage(
  image: HTMLImageElement,
  size = INPUT_SIZE,
): LetterboxInfo {
  const origW = image.naturalWidth;
  const origH = image.naturalHeight;
  const scale = Math.min(size / origH, size / origW);
  const newUnpadW = Math.round(origW * scale);
  const newUnpadH = Math.round(origH * scale);
  const padX = Math.round((size - newUnpadW) / 2 - 0.1);
  const padY = Math.round((size - newUnpadH) / 2 - 0.1);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("캔버스를 만들 수 없습니다.");
  }
  ctx.fillStyle = "rgb(114,114,114)";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, padX, padY, newUnpadW, newUnpadH);

  const { data } = ctx.getImageData(0, 0, size, size);
  const tensor = new Float32Array(3 * size * size);
  const plane = size * size;
  for (let i = 0; i < plane; i += 1) {
    const di = i * 4;
    tensor[i] = data[di] / 255;
    tensor[plane + i] = data[di + 1] / 255;
    tensor[plane * 2 + i] = data[di + 2] / 255;
  }
  return { tensor, scale, padX, padY, origW, origH };
}

export function parseDetections(
  output: Float32Array | number[],
  info: Pick<LetterboxInfo, "scale" | "padX" | "padY" | "origW" | "origH">,
  conf = SCORE_KEEP,
): Detection[] {
  const dets: Detection[] = [];
  const count = Math.floor(output.length / 6);
  for (let i = 0; i < count; i += 1) {
    const offset = i * 6;
    const score = Number(output[offset + 4]);
    if (!(score >= conf)) continue;
    dets.push({
      x1: clamp((Number(output[offset]) - info.padX) / info.scale, 0, info.origW),
      y1: clamp(
        (Number(output[offset + 1]) - info.padY) / info.scale,
        0,
        info.origH,
      ),
      x2: clamp(
        (Number(output[offset + 2]) - info.padX) / info.scale,
        0,
        info.origW,
      ),
      y2: clamp(
        (Number(output[offset + 3]) - info.padY) / info.scale,
        0,
        info.origH,
      ),
      score,
      cls: Math.round(Number(output[offset + 5])),
    });
  }
  dets.sort((a, b) => b.score - a.score);
  return dets;
}

async function fetchModel(onProgress: (ratio: number) => void) {
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error(`모델 파일을 불러오지 못했습니다 (${response.status}).`);
  }
  const total = Number(response.headers.get("content-length") || 0);
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress(1);
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (total > 0) onProgress(Math.min(1, received / total));
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress(1);
  return bytes.buffer;
}

export async function loadSession(onProgress: (ratio: number) => void) {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-web/wasm");
      ort.env.wasm.wasmPaths =
        "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/";
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;
      ort.env.wasm.proxy = false;
      ortModule = ort;
      const model = await fetchModel(onProgress);
      return await ort.InferenceSession.create(model, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
    })().catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

export async function runDetect(
  session: Session,
  image: HTMLImageElement,
): Promise<{ detections: Detection[]; info: LetterboxInfo; ms: number }> {
  if (!ortModule) {
    throw new Error("ONNX Runtime이 아직 준비되지 않았습니다.");
  }
  const info = letterboxImage(image);
  const tensor = new ortModule.Tensor("float32", info.tensor, [
    1,
    3,
    INPUT_SIZE,
    INPUT_SIZE,
  ]);
  const t0 = performance.now();
  const results = await session.run({ images: tensor });
  const ms = performance.now() - t0;
  const output = results.output0;
  const data = output.data as Float32Array | number[];
  return {
    detections: parseDetections(data, info, SCORE_KEEP),
    info,
    ms,
  };
}

export function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 열 수 없습니다."));
    image.src = src;
  });
}
