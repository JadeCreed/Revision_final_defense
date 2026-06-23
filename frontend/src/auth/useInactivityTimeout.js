import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const useInactivityTimeout = (inactivityMinutes = 30) => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120);

  const handleLogout = useCallback(() => {
    navigate('/login', {
      state: { message: 'Session ended due to 30 minutes of inactivity.' },
      replace: true,
    });
  }, [navigate]);

  useEffect(() => {
    let inactivityTimer;
    let warningTimer;
    let countdownInterval;

    const cleanup = () => {
      clearTimeout(inactivityTimer);
      clearTimeout(warningTimer);
      clearInterval(countdownInterval);
    };

    const resetTimers = () => {
      cleanup();
      setShowWarning(false);
      setRemainingSeconds(120);

      warningTimer = setTimeout(() => {
        setShowWarning(true);
        setRemainingSeconds(120);
        countdownInterval = setInterval(() => {
          setRemainingSeconds(prev => (prev <= 1 ? 0 : prev - 1));
        }, 1000);
      }, (inactivityMinutes - 2) * 60 * 1000);

      inactivityTimer = setTimeout(() => {
        cleanup();
        handleLogout();
      }, inactivityMinutes * 60 * 1000);
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    activityEvents.forEach(event => window.addEventListener(event, resetTimers, true));
    resetTimers();

    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, resetTimers, true));
      cleanup();
    };
  }, [inactivityMinutes, handleLogout]);

  return { showWarning, setShowWarning, remainingSeconds };
};