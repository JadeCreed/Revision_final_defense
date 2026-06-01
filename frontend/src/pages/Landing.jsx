// src/pages/Landing.jsx
import { useEffect, useState } from 'react';
import Hero from '../components/Hero';

const Landing = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      // Hide page until we scroll to target to avoid a flash
      setReady(false);
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          // use 'auto' for immediate jump
          el.scrollIntoView({ behavior: 'auto' });
        }
        setReady(true);
      }, 80);
    } else {
      setReady(true);
    }
  }, []);

  return (
    <div style={{ visibility: ready ? 'visible' : 'hidden' }}>
      <Hero />
    </div>
  );
};

export default Landing;