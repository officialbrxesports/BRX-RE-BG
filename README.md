# BRX Background Remover

BRX is a browser-local person-segmentation application. The active application uses the Next.js App Router. Video decoding, segmentation, previews, and exports run in the browser; the selected video is not uploaded. MediaPipe runtime files and the Selfie Segmenter model are downloaded on demand from jsDelivr and Google model storage.

## Active application structure

- `src/app/layout.tsx` defines the English document and metadata and imports the app stylesheet.
- `src/app/page.tsx` is the main UI and coordinates file validation, worker communication, sequential frame processing, retained PNGs, and exports.
- `src/components/FramePreviewPanel.tsx`, `FramePngExportPanel.tsx`, `FrameArchivePanel.tsx`, and `VideoCompatibilityPanel.tsx` are the UI panels used by the active page.
- `src/workers/segmenter.worker.ts` loads MediaPipe with GPU initialization and CPU fallback, segments transferred frames, returns typed masks, and releases bitmap/mask resources.
- `src/lib/videoProcessing.ts` contains shared video limits, frame waits, resolution sizing, mask application, and export helpers.
- `src/lib/frameArchive.ts` enforces the retained-PNG limit and streams a ZIP containing sequentially named PNGs and `README.txt`.
- `src/types/video.ts` shares worker, processing, archive, and export state types. `src/utils/browserCapabilities.ts` contains shared browser capability and input-limit constants.
- `tsconfig.json` includes the Next app and its imported source graph, Next generated types, and Next config. The `@/*` alias resolves to `src/*`; the Vite client type is not part of the active Next project.

The previous Vite implementation remains in `src/App.tsx`, `src/main.tsx`, `src/utils/`, and its Vite-focused components. It is retained for source reference and is not the active app entry. The default `dev`, `build`, `start`, and `preview` scripts now target Next.js. Vite commands are named `vite:dev`, `vite:build`, and `vite:preview`.

## Setup and development

Use a Node.js version supported by the declared Next.js release. The repository currently has `package-lock.json` and `bun.lock`, and their dependency sets do not match `package.json`. Reconcile the chosen package manager and lockfile before performing a clean dependency install. No dependencies or lockfiles were changed in this source-only phase.

After resolving that dependency setup, the Next.js development command is:

```sh
npm run dev
```

The retained Vite source can be started separately with `npm run vite:dev`; it is not the default application.

## Active Next.js features

- Select or drop a video with a 250 MiB maximum, strict 60-second duration limit, source dimension cap of 3840 × 2160, metadata timeout, and browser codec/decode errors.
- Load the real MediaPipe person-segmentation model in a worker with retry, GPU initialization, and CPU fallback.
- Process browser-presented frames sequentially and stop with an incomplete/error state when frame gaps are detected. Progress reports frames processed and timeline reached; the browser does not provide an authoritative encoded source-frame total.
- Choose up to 480p by default. The 720p option is capability-gated by reported device resources. Neither setting enlarges beyond the source dimensions. Native-resolution 4K inference is unavailable.
- Preview the latest transparent PNG frame, download it as a PNG, or export saved frames as a ZIP. ZIP output contains PNG files and a README; it is not a transparent video. Transparent MP4/WebM export is unavailable.
- Retain processed PNG blobs up to 200 MiB and stop before adding a frame that exceeds the remaining budget. This is a retained PNG data limit, not a cap on decoder, model, canvas, bitmap, or temporary ZIP memory. Saved frames remain available after cancellation, and ZIP failures can be retried.
- Browser compatibility information explains why alpha-capable video export is unavailable; reported codec capability alone is not treated as proof of preserved transparency.

Segmentation quality depends on the subject, motion, codec, browser, and device. Hair, blur, occlusion, and non-person content can produce poor masks. Runtime/model downloads require network access. These behaviors have not been tested in this phase.

## Dependency and source follow-up

`lucide-react` is declared in `package.json` and used by the retained Vite-only UI, including `ProcessingSettings.tsx`; that UI is not imported by the active Next page. The current `package-lock.json` root dependencies do not match `package.json` and do not contain the complete current manifest dependency set. A later dependency-management step must reconcile the lockfile and installed packages before using the preserved Vite source or relying on a clean install. This phase deliberately did not install packages or regenerate either lockfile.

No source files were removed. Vite entry/configuration and its processing utilities are retained but isolated from the active Next.js TypeScript entry graph; review them for removal only after the project no longer needs the legacy implementation.
