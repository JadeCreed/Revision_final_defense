import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const InactivityWarningDialog = ({ isOpen, remainingSeconds, onDismiss, onReset }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const handleContinue = () => {
    onReset();   // ← direktang tinatawag ang resetTimers ng hook
    onDismiss();
  };

  const handleLogout = () => {
    navigate('/login', { replace: true });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-amber-100 p-2 rounded-full">
            <Clock className="text-amber-600" size={20} strokeWidth={1.5} />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Session Expiring Soon</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          You've been inactive. Your session will expire in:
        </p>

        <div className="bg-amber-50 rounded-lg py-3 mb-5 text-center">
          <span className="text-3xl font-bold text-amber-600">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleContinue}
            className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Continue Working
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Logout
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-3">
          Any activity resets the timer automatically.
        </p>
      </div>
    </div>
  );
};