# NEU-DET 강판 표면 결함 탐지

NEU-DET로 학습한 YOLO26n(`best.pt`)을 ONNX로 변환해, 브라우저에서 결함 위치와 종류를 보여 주는 Next.js 앱입니다. 추론은 서버가 아니라 브라우저의 ONNX Runtime Web에서 실행됩니다.

## 클래스

| ID | 영문 | 한글 |
| --- | --- | --- |
| 0 | crazing | 크레이징 |
| 1 | inclusion | 개재물 |
| 2 | patches | 패치 |
| 3 | pitted_surface | 피팅 표면 |
| 4 | rolled-in_scale | 압입 스케일 |
| 5 | scratches | 스크래치 |

## 로컬 실행

```bash
npm install
npm run dev
```
