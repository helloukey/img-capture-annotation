import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { releaseCapturedImage } from '@/shared/capturedImage';
import { appFlowReducer, initialAppFlowState, type AppFlowAction, type AppFlowState } from './appFlowReducer';

interface AppFlowContextValue {
  state: AppFlowState;
  dispatch: React.Dispatch<AppFlowAction>;
}

const AppFlowContext = createContext<AppFlowContextValue | null>(null);

export function AppFlowProvider({
  children,
  initialState = initialAppFlowState,
}: {
  children: ReactNode;
  initialState?: AppFlowState;
}) {
  const [state, dispatch] = useReducer(appFlowReducer, initialState);

  // Revoke the previous image's object URL whenever the image is replaced or cleared.
  const previousImage = useRef(state.image);
  useEffect(() => {
    if (previousImage.current && previousImage.current !== state.image) {
      releaseCapturedImage(previousImage.current);
    }
    previousImage.current = state.image;
  }, [state.image]);

  // Release on unmount (closing the app).
  useEffect(() => () => releaseCapturedImage(previousImage.current), []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppFlowContext.Provider value={value}>{children}</AppFlowContext.Provider>;
}

export function useAppFlow(): AppFlowContextValue {
  const ctx = useContext(AppFlowContext);
  if (!ctx) throw new Error('useAppFlow must be used inside <AppFlowProvider>');
  return ctx;
}
