import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { AppFlowProvider } from '@/app/AppFlowContext';
import {
  domError,
  installFakeMediaDevices,
  removeMediaDevices,
  type DomErrorName,
} from '../../../../tests/fakes/fakeMediaDevices';
import { CameraView } from './CameraView';

function renderCamera() {
  return render(
    <AppFlowProvider>
      <CameraView />
    </AppFlowProvider>,
  );
}

function stubPermission(state: PermissionState) {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: async () => ({ state }) },
  });
}

describe('CameraView error states (FR-011, contracts/camera.md UI states)', () => {
  it.each<[DomErrorName, PermissionState, string, string, string]>([
    ['NotAllowedError', 'denied', 'Camera access is blocked', 'Try again', 'Choose a photo'],
    ['NotAllowedError', 'prompt', 'Camera access is needed', 'Allow camera', 'Choose a photo'],
    ['NotFoundError', 'granted', 'No camera found', 'Choose a photo', 'Try again'],
    ['NotReadableError', 'granted', 'Camera is in use', 'Try again', 'Choose a photo'],
  ])('%s with permission %s shows "%s"', async (name, permission, heading, primary, secondary) => {
    stubPermission(permission);
    installFakeMediaDevices({ alwaysFail: domError(name) });
    renderCamera();
    expect(await screen.findByRole('heading', { name: new RegExp(heading) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(primary) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(secondary) })).toBeInTheDocument();
  });

  it('explains insecure contexts and offers only the upload fallback', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    installFakeMediaDevices();
    renderCamera();
    expect(await screen.findByRole('heading', { name: /secure connection/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose a photo/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Try again/ })).not.toBeInTheDocument();
  });

  it('explains unsupported browsers', async () => {
    removeMediaDevices();
    renderCamera();
    expect(
      await screen.findByRole('heading', { name: /doesn.t support camera access/i }),
    ).toBeInTheDocument();
  });

  it('"Try again" requests the camera again and recovers', async () => {
    stubPermission('granted');
    const media = installFakeMediaDevices({ failures: [domError('NotReadableError')] });
    const user = userEvent.setup();
    renderCamera();
    await user.click(await screen.findByRole('button', { name: /Try again/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Capture photo' })).toBeEnabled());
    expect(media.getUserMedia.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('a track ending mid-use shows "Camera disconnected" with Reconnect', async () => {
    const media = installFakeMediaDevices();
    renderCamera();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Capture photo' })).toBeEnabled());
    act(() => media.lastTrack().end());
    expect(await screen.findByRole('heading', { name: /Camera disconnected/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reconnect/ })).toBeInTheDocument();
  });

  it('shows a permission primer while the browser prompt is pending', async () => {
    installFakeMediaDevices();
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: () => new Promise(() => {}),
    });
    renderCamera();
    expect(await screen.findByText(/Allow camera access to take a photo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose a photo instead/ })).toBeInTheDocument();
  });
});
