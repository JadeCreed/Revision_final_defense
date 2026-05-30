// src/pages/Landing.jsx
import { useEffect } from 'react';
import Hero from '../components/Hero';

const Landing = () => {
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      // small timeout to allow the page to render before scrolling
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, []);

  return <Hero />;
};

export default Landing;