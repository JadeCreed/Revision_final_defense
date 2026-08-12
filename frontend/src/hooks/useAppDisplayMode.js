import { useEffect, useState } from 'react';

const getStandaloneState = () => (
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true
);

export const useAppDisplayMode = () => {
  const [isInstalledApp, setIsInstalledApp] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const updateDisplayMode = () => setIsInstalledApp(getStandaloneState());

    updateDisplayMode();
    mediaQuery.addEventListener?.('change', updateDisplayMode);

    return () => mediaQuery.removeEventListener?.('change', updateDisplayMode);
  }, []);

  return isInstalledApp;
};
