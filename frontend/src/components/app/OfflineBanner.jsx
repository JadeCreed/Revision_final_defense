import { WifiOff } from 'lucide-react';

const OfflineBanner = () => (
  <div className="app-offline-banner" role="status">
    <WifiOff size={16} aria-hidden="true" />
    <span>You are offline. Some AgrICE data may be unavailable.</span>
  </div>
);

export default OfflineBanner;
