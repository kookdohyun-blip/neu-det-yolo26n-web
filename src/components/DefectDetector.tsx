"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CLASSES, classOf } from "@/lib/classes";
import {
  loadHtmlImage,
  loadSession,
  runDetect,
  type Detection,
} from "@/lib/yolo";

type Status = "loading" | "ready" | "running" | "error";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function DefectDetector() {
  const [status, setStatus] = useState<Status>("loading");
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(CLASSES[5].sample);
  const [fileLabel, setFileLabel] = useState("샘플 · scratches");
  const [detections, setDetections] = useState<Detection[]>([]);
  const [conf, setConf] = useState(0.25);
  const [inferMs, setInferMs] = useState<number | null>(null);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [dragOver, setDragOver] = useState(false);

  const sessionRef = useRef<Awaited<ReturnType<typeof loadSession>> | null>(
    null,
  );
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const visible = useMemo(
    () => detections.filter((det) => det.score >= conf),
    [detections, conf],
  );

  useEffect(() => {
    let cancelled = false;
    loadSession((ratio) => {
      if (!cancelled) setLoadProgress(ratio);
    })
      .then((session) => {
        if (cancelled) return;
        sessionRef.current = session;
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "모델 로딩에 실패했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const draw = useCallback(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas || !image.complete || image.naturalWidth === 0) return;
    const rect = image.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const sx = rect.width / image.naturalWidth;
    const sy = rect.height / image.naturalHeight;
    for (const det of visible) {
      const meta = classOf(det.cls);
      const x = det.x1 * sx;
      const y = det.y1 * sy;
      const w = (det.x2 - det.x1) * sx;
      const h = (det.y2 - det.y1) * sy;
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 2.4;
      ctx.strokeRect(x, y, w, h);
      const label = `${meta.ko} ${det.score.toFixed(2)}`;
      ctx.font = "600 12px var(--font-sans), Malgun Gothic, sans-serif";
      const tw = ctx.measureText(label).width;
      const labelY = Math.max(0, y - 18);
      ctx.fillStyle = meta.color;
      ctx.fillRect(x, labelY, tw + 10, 18);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x + 5, labelY + 13);
    }
  }, [visible]);

  const infer = useCallback(async (src: string) => {
    const session = sessionRef.current;
    if (!session) return;
    setStatus("running");
    setError(null);
    try {
      const image = await loadHtmlImage(src);
      setImageSize({ w: image.naturalWidth, h: image.naturalHeight });
      const result = await runDetect(session, image);
      setDetections(result.detections);
      setInferMs(result.ms);
      setStatus("ready");
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "추론에 실패했습니다.");
    }
  }, []);

  const modelLoaded = status !== "loading";
  useEffect(() => {
    if (!modelLoaded || !imageUrl) return;
    void infer(imageUrl);
  }, [imageUrl, infer, modelLoaded]);

  useEffect(() => {
    draw();
  }, [draw, imageUrl]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  const setSource = (src: string, label: string, revoke = false) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (revoke) objectUrlRef.current = src;
    setFileLabel(label);
    setImageUrl(src);
  };

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 올릴 수 있습니다.");
      return;
    }
    setSource(URL.createObjectURL(file), file.name, true);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-amber-400/90">
            NEU-DET · YOLO26n · ONNX
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-50">
            강판 표면 결함 탐지
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            사진을 올리면 학습한 YOLO26n이 브라우저에서 바로 결함 위치와 종류를
            표시합니다. 서버로 이미지가 전송되지 않습니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-right text-xs text-zinc-400 sm:min-w-48">
          <div>
            <div className="text-zinc-500">모델</div>
            <div className="font-mono text-zinc-200">YOLO26n 10ep</div>
          </div>
          <div>
            <div className="text-zinc-500">추론</div>
            <div className="font-mono text-zinc-200">
              {inferMs == null ? "—" : `${inferMs.toFixed(0)} ms`}
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div className="space-y-4">
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              onFiles(event.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-5 text-center transition ${
              dragOver
                ? "border-amber-400 bg-amber-400/10"
                : "border-white/15 bg-white/5 hover:border-amber-400/60"
            }`}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => onFiles(event.target.files)}
            />
            <span className="text-sm font-medium text-zinc-100">
              사진을 끌어다 놓거나 클릭해서 선택
            </span>
            <span className="mt-1 font-mono text-xs text-zinc-500">
              {fileLabel}
            </span>
          </label>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#12151c]">
            <div className="relative bg-[linear-gradient(45deg,#1b2029_25%,transparent_25%),linear-gradient(-45deg,#1b2029_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1b2029_75%),linear-gradient(-45deg,transparent_75%,#1b2029_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] p-3">
              {imageUrl ? (
                <div className="relative mx-auto inline-block max-w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="검사 대상"
                    onLoad={draw}
                    className="block max-h-[70vh] max-w-full object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  />
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center text-sm text-zinc-500">
                  이미지를 선택하세요
                </div>
              )}
              {(status === "loading" || status === "running") && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm text-zinc-100">
                  {status === "loading"
                    ? `모델 로딩 ${pct(loadProgress)}`
                    : "추론 중…"}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-xs text-zinc-500">
              <span>
                {imageSize.w && imageSize.h
                  ? `${imageSize.w} × ${imageSize.h}px`
                  : "크기 대기"}
              </span>
              <span>
                표시 {visible.length}개 / 저장 {detections.length}개
              </span>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-zinc-300">예측 신뢰도 임계치</span>
              <strong className="font-mono text-amber-300">{conf.toFixed(2)}</strong>
            </div>
            <input
              type="range"
              min={0.01}
              max={0.99}
              step={0.01}
              value={conf}
              onChange={(event) => setConf(Number(event.target.value))}
              className="w-full accent-amber-400"
            />
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              임계치보다 낮은 박스는 숨깁니다. 다시 추론하지 않습니다.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-medium text-zinc-200">샘플 사진</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {CLASSES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSource(item.sample, `샘플 · ${item.name}`)}
                  className="group overflow-hidden rounded-xl border border-white/10 text-left transition hover:border-amber-400/70"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.sample}
                    alt={item.ko}
                    className="h-16 w-full object-cover"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <span className="block truncate px-2 py-1 text-[11px] text-zinc-300 group-hover:text-white">
                    {item.ko}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-medium text-zinc-200">탐지 결과</h2>
            {error && (
              <p className="mt-2 rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}
            <ul className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
              {visible.length === 0 && (
                <li className="text-sm text-zinc-500">표시할 결함이 없습니다.</li>
              )}
              {visible.map((det, index) => {
                const meta = classOf(det.cls);
                return (
                  <li
                    key={`${det.cls}-${index}-${det.score}`}
                    className="flex items-start justify-between gap-3 rounded-xl bg-black/25 px-3 py-2"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm text-zinc-100">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: meta.color }}
                        />
                        {meta.ko}
                        <span className="font-mono text-xs text-zinc-500">
                          {meta.name}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-zinc-500">
                        ({det.x1.toFixed(0)}, {det.y1.toFixed(0)}) – (
                        {det.x2.toFixed(0)}, {det.y2.toFixed(0)})
                      </div>
                    </div>
                    <span className="font-mono text-sm text-amber-200">
                      {det.score.toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-medium text-zinc-200">클래스</h2>
            <ul className="mt-3 space-y-1.5 text-xs text-zinc-400">
              {CLASSES.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: item.color }}
                  />
                  <span className="w-5 font-mono text-zinc-500">{item.id}</span>
                  {item.ko}
                  <span className="font-mono text-zinc-600">{item.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
