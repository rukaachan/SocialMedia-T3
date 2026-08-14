import {
  MAX_ALT_TEXT_LENGTH,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_DIMENSION,
  MAX_MEDIA_PIXELS,
  MEDIA_PURPOSES,
  type MediaPurpose,
} from "~/lib/media/constants";

export {
  MAX_ALT_TEXT_LENGTH,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_DIMENSION,
  MAX_MEDIA_PIXELS,
  MEDIA_PURPOSES,
};
export type { MediaPurpose } from "~/lib/media/constants";

export type UploadFile = {
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export class MediaValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "MediaValidationError";
  }
}

function readUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUint24(view: DataView, offset: number) {
  return (
    view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16)
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function parsePng(bytes: Uint8Array) {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

function parseJpeg(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    if (marker == null) break;
    offset += 1;

    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (offset + 1 >= bytes.length) break;

    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame && segmentLength >= 7) {
      return {
        height: view.getUint16(offset + 3, false),
        width: view.getUint16(offset + 5, false),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function parseWebp(bytes: Uint8Array) {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkType = ascii(bytes, 12, 4);

  if (chunkType === "VP8X" && bytes.length >= 30) {
    return {
      width: 1 + readUint24(view, 24),
      height: 1 + readUint24(view, 27),
    };
  }

  if (chunkType === "VP8 " && bytes.length >= 30) {
    const frameOffset = 20;
    if (
      bytes[frameOffset + 3] !== 0x9d ||
      bytes[frameOffset + 4] !== 0x01 ||
      bytes[frameOffset + 5] !== 0x2a
    ) {
      return null;
    }

    return {
      width: readUint16(view, frameOffset + 6) & 0x3fff,
      height: readUint16(view, frameOffset + 8) & 0x3fff,
    };
  }

  if (chunkType === "VP8L" && bytes.length >= 25 && view.getUint8(20) === 0x2f) {
    const bits =
      view.getUint8(21) |
      (view.getUint8(22) << 8) |
      (view.getUint8(23) << 16) |
      (view.getUint8(24) << 24);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >>> 14) & 0x3fff),
    };
  }

  return null;
}

export function detectImage(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return {
      mimeType: "image/png",
      extension: "png",
      dimensions: parsePng(bytes),
    };
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return {
      mimeType: "image/jpeg",
      extension: "jpg",
      dimensions: parseJpeg(bytes),
    };
  }

  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return {
      mimeType: "image/webp",
      extension: "webp",
      dimensions: parseWebp(bytes),
    };
  }

  return null;
}

function validateDimensions(dimensions: { width: number; height: number } | null) {
  if (dimensions == null) {
    throw new MediaValidationError("The image dimensions could not be verified.");
  }

  const { width, height } = dimensions;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_MEDIA_DIMENSION ||
    height > MAX_MEDIA_DIMENSION ||
    width * height > MAX_MEDIA_PIXELS
  ) {
    throw new MediaValidationError("The image dimensions are not supported.");
  }

  return dimensions;
}

export function validateImageUpload(file: UploadFile) {
  if (!Number.isFinite(file.size) || file.size < 1) {
    throw new MediaValidationError("Choose an image file.");
  }

  if (file.size > MAX_MEDIA_BYTES) {
    throw new MediaValidationError("Images must be 5 MB or smaller.", 413);
  }
}

export function inspectImage(bytes: Uint8Array) {
  const detected = detectImage(bytes);
  if (detected == null) {
    throw new MediaValidationError("Only JPEG, PNG, and WebP images are supported.", 415);
  }

  return {
    ...detected,
    dimensions: validateDimensions(detected.dimensions),
  };
}
