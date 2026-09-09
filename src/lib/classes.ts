export const INPUT_SIZE = 640;
export const MODEL_URL = "/models/best.onnx";
export const SCORE_KEEP = 0.01;

export type DefectClass = {
  id: number;
  name: string;
  ko: string;
  color: string;
  sample: string;
};

export const CLASSES: DefectClass[] = [
  {
    id: 0,
    name: "crazing",
    ko: "크레이징",
    color: "#e11d48",
    sample: "/samples/crazing.jpg",
  },
  {
    id: 1,
    name: "inclusion",
    ko: "개재물",
    color: "#2563eb",
    sample: "/samples/inclusion.jpg",
  },
  {
    id: 2,
    name: "patches",
    ko: "패치",
    color: "#16a34a",
    sample: "/samples/patches.jpg",
  },
  {
    id: 3,
    name: "pitted_surface",
    ko: "피팅 표면",
    color: "#7c3aed",
    sample: "/samples/pitted_surface.jpg",
  },
  {
    id: 4,
    name: "rolled-in_scale",
    ko: "압입 스케일",
    color: "#ea580c",
    sample: "/samples/rolled-in_scale.jpg",
  },
  {
    id: 5,
    name: "scratches",
    ko: "스크래치",
    color: "#b45309",
    sample: "/samples/scratches.jpg",
  },
];

export function classOf(id: number): DefectClass {
  return CLASSES[id] ?? {
    id,
    name: `class_${id}`,
    ko: `클래스 ${id}`,
    color: "#64748b",
    sample: "",
  };
}
