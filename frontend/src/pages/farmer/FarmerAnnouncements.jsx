// src/pages/farmer/FarmerAnnouncements.jsx
// Uses shared AnnouncementsListPage component.
// basePath tells it what URL to use for detail navigation.

import AnnouncementsListPage from '../../components/announcements/AnnouncementsListPage';

const FarmerAnnouncements = () => (
  <AnnouncementsListPage basePath="/farmer/announcements" />
);

export default FarmerAnnouncements;