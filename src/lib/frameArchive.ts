import { Zip, ZipPassThrough, strToU8 } from "fflate";
import { MAX_ARCHIVE_BUDGET_BYTES } from "@/utils/browserCapabilities";

// Budget applies to the actual encoded PNG blobs retained for export.
export const FRAME_ARCHIVE_BUDGET_BYTES = MAX_ARCHIVE_BUDGET_BYTES;

export function fitsFrameArchiveBudget(currentBytes: number, nextFrameBytes: number, budgetBytes = FRAME_ARCHIVE_BUDGET_BYTES) {
  return currentBytes >= 0 && nextFrameBytes > 0 && budgetBytes > 0 && currentBytes + nextFrameBytes <= budgetBytes;
}

export type ArchivedFrame = {
  fileName: string;
  mediaTime: number;
  resolution: string;
  width: number;
  height: number;
  blob: Blob;
};

export async function createFrameZip(
  frames: readonly ArchivedFrame[],
  readme: string,
  signal: AbortSignal,
  onFrameAdded: (count: number) => void,
) {
  const streamState: { controller: ReadableStreamDefaultController<Uint8Array> | null } = {
    controller: null,
  };
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  const zip = new Zip((error, chunk, final) => {
    const controller = streamState.controller;
    if (!controller) return;
    if (error) {
      controller.error(error);
      return;
    }
    if (chunk.length > 0) controller.enqueue(chunk);
    if (final) controller.close();
  });
  const output = new ReadableStream<Uint8Array>({
    start(controller) {
      streamState.controller = controller;
    },
  });
  const archivePromise = new Response(output, {
    headers: { "Content-Type": "application/zip" },
  }).blob();

  try {
    for (let index = 0; index < frames.length; index += 1) {
      if (signal.aborted) throw new DOMException("ZIP creation cancelled.", "AbortError");
      const frame = frames[index];
      const entry = new ZipPassThrough(frame.fileName);
      zip.add(entry);
      activeReader = frame.blob.stream().getReader();

      while (true) {
        const { done, value } = await activeReader.read();
        if (signal.aborted) throw new DOMException("ZIP creation cancelled.", "AbortError");
        if (done) break;
        entry.push(value);
      }

      activeReader.releaseLock();
      activeReader = null;
      entry.push(new Uint8Array(0), true);
      onFrameAdded(index + 1);
    }

    const readmeEntry = new ZipPassThrough("README.txt");
    zip.add(readmeEntry);
    readmeEntry.push(strToU8(readme), true);
    zip.end();

    const archive = await archivePromise;
    if (signal.aborted) throw new DOMException("ZIP creation cancelled.", "AbortError");
    return archive;
  } catch (error) {
    await activeReader?.cancel().catch(() => {});
    try {
      streamState.controller?.error(error);
    } catch {
      // The stream may already be closed or errored by fflate.
    }
    await archivePromise.catch(() => {});
    throw error;
  } finally {
    activeReader?.releaseLock();
  }
}