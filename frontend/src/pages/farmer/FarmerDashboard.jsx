// src/pages/farmer/FarmerDashboard.jsx
const FarmerDashboard = () => (
  <div>
    <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>Farmer Dashboard</h1>
    <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Welcome to your farmer portal.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      {['My Profile', 'Crop Status', 'Announcements', 'Seed Poll'].map(label => (
        <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.25rem', minHeight: '100px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ fontWeight: '600' }}>{label}</p>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.5rem' }}>Coming soon</p>
        </div>
      ))}
    </div>
  </div>
);
export default FarmerDashboard;