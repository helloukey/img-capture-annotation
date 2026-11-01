import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import schema from '../../../../specs/001-image-capture-annotation/contracts/export-format.schema.json';
import { assessQuality } from '@/features/quality/lib/assess';
import type { CapturedImage } from '@/shared/types';
import type { Annotation } from './annotationReducer';
import { buildExport, exportFileName } from './exportAnnotations';

const image = {
  id: 'i',
  width: 4032,
  height: 3024,
  byteSize: 3_400_000,
  mimeType: 'image/jpeg',
  source: 'camera',
  capturedAt: Date.UTC(2026, 10, 1, 12, 0, 0),
} as CapturedImage;

const items: Annotation[] = [
  { id: 'a1', label: 'Bottle', ordinal: 1, createdAt: 1, x: 10.4, y: 20.6, width: 300.5, height: 400.2 },
  { id: 'a2', label: '', ordinal: 2, createdAt: 2, x: 0, y: 0, width: 0.4, height: 1 },
];

const validate = (() => {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
})();

describe('buildExport', () => {
  it('produces data that validates against the export schema', () => {
    const data = buildExport(
      image,
      items,
      assessQuality({ ...image, brightnessPct: 50, sharpness: 200 }),
      new Date('2026-11-01T12:30:00Z'),
    );
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
  });

  it('uses integer full-resolution pixel coordinates and keeps labels ≤ 50 chars', () => {
    const data = buildExport(image, [{ ...items[0]!, label: 'x'.repeat(80) }], null);
    expect(data.annotations[0]).toMatchObject({ bbox: { x: 10, y: 21, width: 301, height: 400 } });
    expect(data.annotations[0]!.label).toHaveLength(50);
    expect(data.image).toMatchObject({ width: 4032, height: 3024 });
  });

  it('never exports a zero-size box', () => {
    const data = buildExport(image, items, null);
    expect(data.annotations[1]!.bbox.width).toBeGreaterThanOrEqual(1);
  });

  it('names files from the capture time', () => {
    expect(exportFileName(image, 'json')).toBe('annotations-2026-11-01T12-00-00.json');
  });
});
