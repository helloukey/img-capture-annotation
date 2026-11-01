import { describe, expect, it, vi } from 'vitest';
import { fakeImageBlob } from '../../../../tests/fakes/fakeImage';
import { installFakeImageCapture } from '../../../../tests/fakes/fakeImageCapture';
import { FakeTrack } from '../../../../tests/fakes/fakeTrack';
import { capturePhoto, JPEG_QUALITY } from './capture';
import { decodeImage } from './decodeImage';

function fakeVideo(width: number, height: number) {
  const video = document.createElement('video');
  Object.defineProperty(video, 'videoWidth', { value: width });
  Object.defineProperty(video, 'videoHeight', { value: height });
  // CSS size is deliberately tiny: capture must ignore it.
  Object.defineProperty(video, 'clientWidth', { value: 320 });
  return video;
}

function stubCanvas() {
  const drawImage = vi.fn();
  const toBlob = vi.fn(function (this: HTMLCanvasElement, cb: BlobCallback, type?: string, quality?: number) {
    void type;
    void quality;
    cb(fakeImageBlob(this.width, this.height, 1_500_000));
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlob);
  return { drawImage, toBlob };
}

const track = () => new FakeTrack() as unknown as MediaStreamTrack;

describe('capturePhoto', () => {
  it('uses ImageCapture.takePhoto at the max photo capabilities when available', async () => {
    const ic = installFakeImageCapture({ photoWidth: 4032, photoHeight: 3024 });
    const result = await capturePhoto({ track: track(), video: fakeVideo(1920, 1080), decode: decodeImage });
    expect(ic.takePhoto).toHaveBeenCalledWith({ imageWidth: 4032, imageHeight: 3024 });
    expect(result).toMatchObject({ captureMethod: 'image-capture', width: 4032, height: 3024 });
  });

  it('falls back to a canvas sized to the real video resolution when ImageCapture is missing', async () => {
    const { drawImage, toBlob } = stubCanvas();
    const result = await capturePhoto({ track: track(), video: fakeVideo(3840, 2160), decode: decodeImage });
    expect(result).toMatchObject({ captureMethod: 'canvas', width: 3840, height: 2160 });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 3840, 2160);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', JPEG_QUALITY);
    expect(JPEG_QUALITY).toBeGreaterThanOrEqual(0.92);
  });

  it('falls back to the canvas when takePhoto rejects', async () => {
    installFakeImageCapture({ fail: true });
    stubCanvas();
    const result = await capturePhoto({ track: track(), video: fakeVideo(1920, 1080), decode: decodeImage });
    expect(result.captureMethod).toBe('canvas');
  });

  it('prefers the canvas frame when takePhoto returns fewer pixels than the live stream', async () => {
    installFakeImageCapture({ photoWidth: 640, photoHeight: 480 });
    stubCanvas();
    const result = await capturePhoto({ track: track(), video: fakeVideo(1920, 1080), decode: decodeImage });
    expect(result).toMatchObject({ captureMethod: 'canvas', width: 1920, height: 1080 });
  });

  it('throws when there is no frame to capture', async () => {
    stubCanvas();
    await expect(
      capturePhoto({ track: track(), video: fakeVideo(0, 0), decode: decodeImage }),
    ).rejects.toThrow();
  });
});
