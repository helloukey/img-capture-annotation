import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CapturedImage } from '@/shared/types';
import { assessQuality } from '../lib/assess';
import { QualityIndicator } from './QualityIndicator';

const image = {
  id: 'q',
  width: 4032,
  height: 3024,
  byteSize: 3_400_000,
  captureMethod: 'image-capture',
  mimeType: 'image/jpeg',
} as CapturedImage;
const good = assessQuality({
  width: 4032,
  height: 3024,
  byteSize: 3_400_000,
  brightnessPct: 50,
  sharpness: 300,
});
const dark = assessQuality({
  width: 4032,
  height: 3024,
  byteSize: 3_400_000,
  brightnessPct: 8,
  sharpness: 12,
});

describe('QualityIndicator', () => {
  it('shows verdict, actual resolution and file size', () => {
    render(<QualityIndicator variant="full" assessment={good} image={image} />);
    const status = screen.getByRole('status', { name: 'Image quality' });
    expect(within(status).getAllByText('Good').length).toBeGreaterThan(0);
    expect(status).toHaveTextContent('12.2 MP (4032 × 3024) · 3.4 MB');
  });

  it('names each failed check with a message and an improvement tip', () => {
    render(<QualityIndicator variant="full" assessment={dark} image={image} />);
    const status = screen.getByRole('status', { name: 'Image quality' });
    expect(within(status).getAllByText('Poor').length).toBeGreaterThan(0);
    expect(status).toHaveTextContent('The image is too dark.');
    expect(status).toHaveTextContent('The image looks blurry.');
    expect(status).toHaveTextContent(/Hold the device steady/);
  });

  it('shows analyzing placeholders while pending', () => {
    render(
      <QualityIndicator
        variant="full"
        assessment={{
          ...assessQuality({
            width: 4032,
            height: 3024,
            byteSize: 3_400_000,
            brightnessPct: null,
            sharpness: null,
          }),
          status: 'pending',
        }}
        image={image}
      />,
    );
    expect(screen.getAllByText('Analyzing…')).toHaveLength(2);
  });

  it('the compact badge expands to the full indicator', async () => {
    const user = userEvent.setup();
    render(<QualityIndicator variant="compact" assessment={dark} image={image} />);
    await user.click(screen.getByRole('button', { name: /Image quality:\s*Poor/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Image quality' });
    expect(dialog).toHaveTextContent('The image is too dark.');
  });
});
