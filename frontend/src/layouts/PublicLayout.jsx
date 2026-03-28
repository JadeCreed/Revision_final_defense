// src/layouts/PublicLayout.jsx
// Wraps public pages (Landing, Register) with the top Navbar only
// Dashboards do NOT use this layout

import Navbar from '../components/Navbar';
import { Outlet } from 'react-router-dom';

const PublicLayout = () => {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
};

export default PublicLayout;