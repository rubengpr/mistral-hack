import type { FileUIPart } from 'ai';

import type { MistralChatPhoto } from '@/types/mistral-chat';

export const FIELD_PHOTO_INPUT_MAX_BYTES = 10_000_000;
export const FIELD_PHOTO_OUTPUT_MAX_BYTES = 1_500_000;
export const FIELD_PHOTO_MAX_DIMENSION = 1_600;

const JPEG_QUALITY_STEP = 0.08;
const MINIMUM_JPEG_QUALITY = 0.52;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error('The field photo could not be compressed.'));
      },
      'image/jpeg',
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('The field photo could not be prepared.'));
    });
    reader.addEventListener('error', () => {
      reject(new Error('The field photo could not be prepared.'));
    });
    reader.readAsDataURL(blob);
  });
}

async function loadImage(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener(
        'error',
        () => reject(new Error('The selected field photo could not be read.')),
        { once: true },
      );
      image.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareFieldPhoto(
  file: FileUIPart,
): Promise<MistralChatPhoto> {
  if (!file.url || !file.mediaType || !file.filename) {
    throw new Error('Select a valid field photo before sending.');
  }

  const response = await fetch(file.url);
  const source = await response.blob();

  if (source.size > FIELD_PHOTO_INPUT_MAX_BYTES) {
    throw new Error('The field photo must be 10 MB or smaller.');
  }

  const image = await loadImage(source);
  const scale = Math.min(
    1,
    FIELD_PHOTO_MAX_DIMENSION /
      Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('The field photo could not be prepared in this browser.');
  }

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.84;
  let compressed = await canvasToBlob(canvas, quality);

  while (
    compressed.size > FIELD_PHOTO_OUTPUT_MAX_BYTES &&
    quality > MINIMUM_JPEG_QUALITY
  ) {
    quality = Math.max(MINIMUM_JPEG_QUALITY, quality - JPEG_QUALITY_STEP);
    compressed = await canvasToBlob(canvas, quality);
  }

  if (compressed.size > FIELD_PHOTO_OUTPUT_MAX_BYTES) {
    throw new Error(
      'The field photo remains too large after compression. Choose a smaller image.',
    );
  }

  return {
    id: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    dataUrl: await blobToDataUrl(compressed),
    fileName: file.filename.replace(/\.[^.]+$/, '') + '.jpg',
    mediaType: 'image/jpeg',
  };
}
