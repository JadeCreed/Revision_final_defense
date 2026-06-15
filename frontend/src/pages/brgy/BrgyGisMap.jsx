// src/pages/brgy/BrgyGisMap.jsx
import { useState, useEffect } from 'react';
import API, { getGisActivePoll } from '../../api/axios';
import { RoleGisMap } from '../at/ATGisMap';

const BrgyGisMap = () => {
  const [assignedBarangays, setAssignedBarangays] = useState(null);
  const [activePoll,        setActivePoll]        = useState(null);

  useEffect(() => {
    Promise.allSettled([
      API.get('/accounts/me/'),
      getGisActivePoll(),
    ]).then(([meRes, pollRes]) => {
      if (meRes.status === 'fulfilled') {
        const brgy = meRes.value.data?.barangay || '';
        setAssignedBarangays(brgy ? [brgy] : []);
      } else {
        setAssignedBarangays([]);
      }
      if (pollRes.status === 'fulfilled') setActivePoll(pollRes.value.data);
    });
  }, []);

  if (assignedBarangays === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ width: 24, height: 24, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%' }} />
    </div>
  );

  return (
    <RoleGisMap
      assignedBarangays={assignedBarangays}
      roleLabel="Barangay President"
      pollId={activePoll?.poll_id || null}
    />
  );
};

export default BrgyGisMap;