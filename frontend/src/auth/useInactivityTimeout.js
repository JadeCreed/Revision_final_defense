import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export const useInactivityTimeout = (inactivityMinutes = 30) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const timerRef = useRef(null);
  const logoutRef = useRef(null);

  // i-store ang pinakabagong logout + navigate sa ref
  // para hindi mag-recreate ng event listener sa bawat render
  logoutRef.current = async () => {
    await logout();
    navigate('/login', {
      state: { message: 'Session ended due to inactivity.' },
      replace: true,
    });
  };

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        logoutRef.current();
      }, inactivityMinutes * 60 * 1000);
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    activityEvents.forEach(e => window.addEventListener(e, resetTimer, true));
    resetTimer(); // start timer on mount

    return () => {
      activityEvents.forEach(e => window.removeEventListener(e, resetTimer, true));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inactivityMinutes]); // isang beses lang mag-attach ng listeners
};