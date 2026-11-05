import { useState } from 'react';
import { useSession } from '@/app/AppContext';
import type { QualityAssessment } from '@/features/quality/lib/types';
import type { CapturedImage } from '@/shared/types';
import { Button } from '@/shared/ui/Button';
import { Download, LoaderCircle } from '@/shared/ui/icons';
import { Popover } from '@/shared/ui/Popover';
import { notify } from '@/shared/ui/toast';
import { useAnnotations } from '../hooks/useAnnotations';
import {
  buildExport,
  downloadBlob,
  downloadJson,
  exportFileName,
  renderAnnotatedImage,
} from '../lib/exportAnnotations';

/** Enhancement (US8): download annotation JSON or the photo with boxes drawn on it. */
export function ExportMenu({ image, quality }: { image: CapturedImage; quality: QualityAssessment | null }) {
  const { state } = useAnnotations();
  const { photos } = useSession();
  const photoIndex = photos.length > 1 ? photos.findIndex((p) => p.id === image.id) + 1 : undefined;
  const [open, setOpen] = useState(false);
  const [rendering, setRendering] = useState(false);
  const empty = state.items.length === 0;

  const exportData = () => {
    downloadJson(buildExport(image, state.items, quality), exportFileName(image, 'json', photoIndex));
    notify.success('Annotations exported');
    setOpen(false);
  };

  const exportImage = async () => {
    setRendering(true);
    try {
      downloadBlob(await renderAnnotatedImage(image, state.items), exportFileName(image, 'jpg', photoIndex));
      notify.success('Annotated image exported');
      setOpen(false);
    } catch {
      notify.error('Couldn’t export the image');
    } finally {
      setRendering(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          disabled={empty}
          className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm hover:bg-white/10 disabled:opacity-40"
        >
          <Download size={18} aria-hidden />
          <span className="sr-only lg:not-sr-only">Export</span>
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">
          Export {state.items.length} annotation{state.items.length === 1 ? '' : 's'}
        </p>
        <Button variant="secondary" onClick={exportData}>
          Data (JSON, full-resolution pixels)
        </Button>
        <Button variant="secondary" onClick={() => void exportImage()} disabled={rendering}>
          {rendering && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
          Image with boxes (JPEG)
        </Button>
      </div>
    </Popover>
  );
}
