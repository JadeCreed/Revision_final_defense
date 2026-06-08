// ─── SHARED CONSTANTS & UTILITIES FOR PRODUCTION MODULE ───────

export const SEED_CFG = {
  HYBRID:   { label: 'Hybrid seeds',       color: '#1a4d1a', bg: '#f0fdf4', border: '#bbf7d0', target_kg_ha: 5000 },
  INBRED:   { label: 'Certified seeds',    color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', target_kg_ha: 4000 },
  OWN_SEED: { label: 'Farmer saved seeds', color: '#b45309', bg: '#fefce8', border: '#fde68a', target_kg_ha: 3000 },
};

export const SEED_KEYS = ['HYBRID', 'INBRED', 'OWN_SEED'];

export const TIER_CFG = [
  { key: 'Exceeded Target', min: 100.01, color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  { key: 'Achieved Target', min: 80,     color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  { key: 'Near Target',     min: 70,     color: '#0369a1', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'Below Target',    min: 50,     color: '#b45309', bg: '#fefce8', border: '#fde68a' },
  { key: 'Critical',        min: 0,      color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
];

export const getUtilTier = (pct) => {
  if (pct === null || pct === undefined)
    return { key: 'N/A', label: 'N/A', color: '#94a3b8', bg: '#f9fafb', border: '#e5e7eb' };
  if (pct > 100) return TIER_CFG[0];
  return TIER_CFG.find(t => pct >= t.min) || TIER_CFG[TIER_CFG.length - 1];
};

export const computeUtil = (rec) => {
  const bags   = parseFloat(rec.harvest_bags) || 0;
  const area   = parseFloat(rec.harvest_area_ha) || 0;
  const seed   = rec.seed_source || 'OWN_SEED';
  const target = SEED_CFG[seed]?.target_kg_ha || 3000;
  const harvKg = bags * 50;
  const expKg  = area * target;
  if (expKg <= 0) return null;
  return (harvKg / expKg) * 100;
};

export const computeMetrics = (rec) => {
  const bags       = parseFloat(rec.harvest_bags) || 0;
  const area       = parseFloat(rec.harvest_area_ha) || 0;
  const seed       = rec.seed_source || 'OWN_SEED';
  const target     = SEED_CFG[seed]?.target_kg_ha || 3000;
  const harvest_kg = bags * 50;
  const harvest_mt = harvest_kg / 1000;
  const yield_t_ha = area > 0 ? harvest_mt / area : 0;
  const expected_kg = area * target;
  const util_pct   = expected_kg > 0 ? (harvest_kg / expected_kg) * 100 : null;
  // Seed productivity — actual distribution received (bags × kg per bag)
  const SEED_BAG_KG  = { HYBRID: 15, INBRED: 20, OWN_SEED: 0 };
  const bagsReceived = parseFloat(rec.seed_bags_received) || 0;
  const seed_dist_kg = bagsReceived * (SEED_BAG_KG[seed] || 0);
  const prod_seed_equiv = (seed_dist_kg > 0 && expected_kg > 0)
    ? (harvest_kg / expected_kg) * seed_dist_kg
    : 0;
  const yield_gap_equiv = Math.max(0, seed_dist_kg - prod_seed_equiv);
  return { harvest_kg, harvest_mt, yield_t_ha, expected_kg, util_pct, seed_dist_kg, prod_seed_equiv, yield_gap_equiv };
};

export const fmtNum = (n, d = 2) =>
  n != null && !isNaN(n)
    ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

export const UtilBadge = ({ pct }) => {
  const tier = getUtilTier(pct);
  return (
    <span style={{
      backgroundColor: tier.bg, color: tier.color,
      border: `1px solid ${tier.border}`,
      borderRadius: '999px', padding: '0.15rem 0.625rem',
      fontSize: '0.65rem', fontWeight: 700,
      whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
    }}>
      {pct != null ? `${fmtNum(pct, 1)}% · ` : ''}{tier.key}
    </span>
  );
};