import { useEffect, useState } from 'react';

const isStandalone = () => (
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true
);

export const usePwaInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (installed) return;

    if (!deferredPrompt) {
      window.alert(
        'AgrICE is ready to install. Open your browser menu and choose "Install AgrICE" or "Add to Home screen".'
      );
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (outcome === 'accepted') {
      setInstalled(true);
    }
  };

  return { install, installed };
};
