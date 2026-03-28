// src/pages/admin/AdminDashboard.jsx
const AdminDashboard = () => (
  <div>
    <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a' }}>Admin Dashboard</h1>
    <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem' }}>Rice Program Coordinator (MAO)</p>
    <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
      <span>⚠️ <strong>Pending farmer registrations awaiting approval</strong></span>
      <button style={{ backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.375rem 1rem', cursor: 'pointer' }}>Review</button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
      {['Total Farmers', 'Approved', 'Pending', 'Barangays'].map(label => (
        <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.25rem', minHeight: '100px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>{label}</p>
          <p style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1a4d1a' }}>—</p>
        </div>
      ))}
    </div>
  </div>
);
export default AdminDashboard;