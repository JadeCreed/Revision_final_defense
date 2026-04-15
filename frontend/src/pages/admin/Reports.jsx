// src/pages/admin/Reports.jsx
// ─────────────────────────────────────────────────────────────
// AGRICE Report Generation
//
// REPORT TYPES:
//   REGION_MASTERLIST     — Beneficiaries list, Hybrid/Region seeds
//   PHILRICE_MASTERLIST   — Beneficiaries list, Inbred/PhilRice seeds
//   DISTRIBUTION_REGION   — Distribution list, Hybrid/Region seeds
//   DISTRIBUTION_PHILRICE — Distribution list, Inbred/PhilRice seeds
//   PLANTING_REPORT       — Planting accomplishment summary
//   HARVESTING_REPORT     — Harvest accomplishment summary (placeholder)
//
// FILTER LOGIC:
//   Default season/year is auto-filled from the latest FinalSeed.
//   Admin can override via dropdown selectors.
//   Beneficiaries/Distribution reports also allow seed type sub-filter.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Download, Filter, Clock,
  CheckCircle, AlertCircle, Eye, BarChart2, Wheat,
  RefreshCw, X, Printer, ChevronDown, Search, Users,
} from 'lucide-react';
import {
  getReportFilterOptions,
  getReportPreview,
  downloadReport,
  getReportLogs,
} from '../../api/axios';

// ─────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────
const GREEN = {
  primary: '#1a4d1a',
  light: '#f0fdf4',
  border: '#bbf7d0',
  accent: '#166534',
  soft: '#dcfce7',
};

// ─────────────────────────────────────────
// REPORT CATEGORIES
// Two main categories, each with two sub-types (Hybrid / Inbred)
// ─────────────────────────────────────────
const REPORT_CATEGORIES = [
  {
    // Beneficiaries masterlist — signing phase data
    key: 'MASTERLIST',
    label: 'Registered Masterlist',
    description: 'Lists of farmer-beneficiaries encoded and approved in the Beneficiaries menu. Includes signing data (farm area, demographics, signature).',
    icon: Users,
    color: GREEN.primary,
    bg: GREEN.light,
    border: GREEN.border,
    // The two sub-types for this category
    subtypes: [
      {
        key: 'REGION_MASTERLIST',
        label: 'Hybrid / Region',
        desc: 'DA RFO IV-A format — NRP / RFO seeds',
        color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe',
      },
      {
        key: 'PHILRICE_MASTERLIST',
        label: 'Inbred / PhilRice',
        desc: 'FAR V8.0 format — RCEF seeds',
        color: GREEN.primary, bg: GREEN.light, border: GREEN.border,
      },
    ],
  },
  {
    // Distribution masterlist — distribution phase data
    key: 'DISTRIBUTION',
    label: 'Distribution Masterlist',
    description: 'Lists farmers with confirmed distribution data (qty bags, date received, crop establishment) encoded and approved in the Distribution menu.',
    icon: Wheat,
    color: '#854d0e',
    bg: '#fffbeb',
    border: '#fde68a',
    subtypes: [
      {
        key: 'DISTRIBUTION_REGION',
        label: 'Hybrid / Region',
        desc: 'Confirmed distribution — NRP / RFO seeds',
        color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe',
      },
      {
        key: 'DISTRIBUTION_PHILRICE',
        label: 'Inbred / PhilRice',
        desc: 'Confirmed distribution — RCEF seeds',
        color: GREEN.primary, bg: GREEN.light, border: GREEN.border,
      },
    ],
  },
  {
    // Planting accomplishment — summary per barangay
    key: 'PLANTING_REPORT',
    label: 'Planting Report',
    description: 'Summary of planting activity per barangay — beneficiaries count, total area planted, variety, crop establishment, and bags.',
    icon: BarChart2,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    subtypes: null,  // No sub-type needed — covers all seed types
  },
  {
    // Harvesting accomplishment — placeholder
    key: 'HARVESTING_REPORT',
    label: 'Harvesting Report',
    description: 'Harvest accomplishment summary. Harvest columns will be filled once Yield Encode data is available.',
    icon: BarChart2,
    color: '#9a3412',
    bg: '#fff7ed',
    border: '#fed7aa',
    subtypes: null,
  },
];

// Preview columns per report type
const PREVIEW_COLS = {
  REGION_MASTERLIST: [
    { key: 'row_number', label: 'No.' },
    { key: 'rsbsa', label: 'RSBSA' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'first_name', label: 'First Name' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'farm_area_ha', label: 'Farm Area (ha)' },
    { key: 'qty_bags', label: 'QTY (bags)' },
    { key: 'variety_name', label: 'Variety' },
    { key: 'has_signature', label: 'Signed' },
  ],
  PHILRICE_MASTERLIST: [
    { key: 'row_number', label: 'No.' },
    { key: 'rsbsa', label: 'RSBSA' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'first_name', label: 'First Name' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'area_planted', label: 'Area Planted (ha)' },
    { key: 'variety_name', label: 'Variety' },
    { key: 'data_sharing', label: 'Data Sharing' },
    { key: 'has_signature', label: 'Signed' },
  ],
  DISTRIBUTION_REGION: [
    { key: 'row_number', label: 'No.' },
    { key: 'rsbsa', label: 'RSBSA' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'first_name', label: 'First Name' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'farm_area_ha', label: 'Farm Area (ha)' },
    { key: 'qty_bags', label: 'QTY (bags)' },
    { key: 'variety_name', label: 'Variety' },
  ],
  DISTRIBUTION_PHILRICE: [
    { key: 'row_number', label: 'No.' },
    { key: 'rsbsa', label: 'RSBSA' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'first_name', label: 'First Name' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'qty_bags', label: 'Bags' },
    { key: 'variety_name', label: 'Variety' },
    { key: 'crop_establishment', label: 'Crop Estab.' },
    { key: 'date_received', label: 'Date Received' },
  ],
  PLANTING_REPORT: [
    { key: 'barangay', label: 'Barangay' },
    { key: 'organization', label: 'Organization' },
    { key: 'variety_name', label: 'Variety' },
    { key: 'farm_area_ha', label: 'Farm Area (ha)' },
    { key: 'area_planted', label: 'Area Planted (ha)' },
    { key: 'crop_establishment', label: 'Crop Estab.' },
    { key: 'qty_bags', label: 'Bags' },
  ],
  HARVESTING_REPORT: [
    { key: 'barangay', label: 'Barangay' },
    { key: 'organization', label: 'Organization' },
    { key: 'variety_name', label: 'Variety' },
    { key: 'area_planted', label: 'Area Planted (ha)' },
    { key: 'qty_bags', label: 'Bags Distributed' },
  ],
};

// Human-readable labels for the log table
const REPORT_LABELS = {
  REGION_MASTERLIST: 'Region Masterlist',
  PHILRICE_MASTERLIST: 'PhilRice Masterlist',
  DISTRIBUTION_REGION: 'Distribution (Region)',
  DISTRIBUTION_PHILRICE: 'Distribution (PhilRice)',
  PLANTING_REPORT: 'Planting Report',
  HARVESTING_REPORT: 'Harvesting Report',
};

// ─────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────

const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 600,
      backgroundColor: toast.type === 'success' ? GREEN.primary : '#991b1b',
      color: 'white', padding: '0.75rem 1.5rem',
      borderRadius: '0.875rem', fontWeight: 600, fontSize: '0.875rem',
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      animation: 'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      maxWidth: 'calc(100vw - 2rem)',
    }}>
      {toast.type === 'success'
        ? <CheckCircle size={16} />
        : <AlertCircle size={16} />
      }
      {toast.message}
    </div>
  );
};

const Spinner = ({ size = 16, color = 'white' }) => (
  <div style={{
    width: size, height: size,
    border: `2px solid ${color}40`,
    borderTopColor: color,
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    flexShrink: 0,
  }} />
);

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────

export default function Reports() {
  // ── Selected report ──
  // selectedCategory: which of the 4 main cards is selected
  // selectedSubtype: which sub-type (Hybrid or Inbred) if applicable
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubtype, setSelectedSubtype] = useState('');

  // ── Filters ──
  const [filterOptions, setFilterOptions] = useState({
    seasons: [], years: [], barangays: [],
    current_season: null, current_year: null,
  });
  const [selectedSeason, setSelectedSeason] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');

  // ── Preview modal ──
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSearch, setPreviewSearch] = useState('');

  // ── Download ──
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  // ── Logs ──
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState(null);
  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ─────────────────────────────────────────
  // LOAD FILTER OPTIONS ON MOUNT
  // ─────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [optRes, logRes] = await Promise.all([
          getReportFilterOptions(),
          getReportLogs(),
        ]);
        const opts = optRes.data;
        setFilterOptions(opts);
        setLogs(logRes.data || []);

        // Auto-fill default season/year from the current FinalSeed
        // so the admin sees the most recent season by default
        if (opts.current_season) setSelectedSeason(opts.current_season);
        else if (opts.seasons?.[0]) setSelectedSeason(opts.seasons[0]);

        if (opts.current_year) setSelectedYear(String(opts.current_year));
        else if (opts.years?.[0]) setSelectedYear(String(opts.years[0]));
      } catch {
        showToast('error', 'Failed to load filter options.');
      }
    };
    load();
  }, [showToast]);

  // ─────────────────────────────────────────
  // DERIVED: the actual report type key to send to API
  // ─────────────────────────────────────────
  const activeReportType = (() => {
    const cat = REPORT_CATEGORIES.find(c => c.key === selectedCategory);
    if (!cat) return '';
    if (cat.subtypes) return selectedSubtype || '';  // Must pick a subtype
    return cat.key;  // Planting / Harvesting = no subtype
  })();

  const activeCatCfg = REPORT_CATEGORIES.find(c => c.key === selectedCategory);
  const activeSubCfg = activeCatCfg?.subtypes?.find(s => s.key === selectedSubtype);

  // ─────────────────────────────────────────
  // PREVIEW
  // ─────────────────────────────────────────
  const handlePreview = async () => {
    if (!activeReportType) {
      showToast('error', activeCatCfg?.subtypes
        ? 'Please choose Hybrid or Inbred for this report.'
        : 'Please select a report type first.');
      return;
    }
    setPreviewLoading(true);
    setPreviewSearch('');
    setPreviewOpen(true);
    setPreviewData(null);
    try {
      const res = await getReportPreview({
        report_type: activeReportType,
        season: selectedSeason,
        year: selectedYear,
        barangay: selectedBarangay,
      });
      setPreviewData(res.data);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to load preview.';
      showToast('error', errMsg);
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // DOWNLOAD
  // ─────────────────────────────────────────
  const handleDownload = async () => {
    if (!activeReportType) {
      showToast('error', activeCatCfg?.subtypes
        ? 'Please choose Hybrid or Inbred first.'
        : 'Please select a report type first.');
      return;
    }
    setDownloading(true);
    try {
      const res = await downloadReport({
        report_type: activeReportType,
        season: selectedSeason,
        year: selectedYear,
        barangay: selectedBarangay,
      });

      // Trigger browser file download
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      const name = `${REPORT_LABELS[activeReportType] || activeReportType}`
        + `_${selectedSeason || 'ALL'}_${selectedYear || 'ALL'}`
        + (selectedBarangay ? `_${selectedBarangay}` : '')
        + '.xlsx';
      link.href = url;
      link.setAttribute('download', name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast('success', 'Report downloaded successfully.');

      // Refresh logs
      const logRes = await getReportLogs();
      setLogs(logRes.data || []);
    } catch (err) {
      const errMsg = err.response?.data?.error
        || 'No data found for selected filters. Check that batches are approved.';
      showToast('error', errMsg);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    if (!activeReportType) {
      showToast('error', activeCatCfg?.subtypes
        ? 'Please choose Hybrid or Inbred first.'
        : 'Please select a report type first.');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('error', 'Unable to open the print window. Please check your popup settings.');
      return;
    }
    printWindow.document.write('<html><head><title>Preparing print...</title></head><body><p>Preparing report for print...</p></body></html>');
    printWindow.document.close();
    setPrinting(true);
    try {
      let rows = previewData?.rows || [];
      if (!rows.length) {
        const res = await getReportPreview({
          report_type: activeReportType,
          season: selectedSeason,
          year: selectedYear,
          barangay: selectedBarangay,
        });
        rows = res.data?.rows || [];
      }
      if (rows.length === 0) {
        printWindow.document.body.innerHTML = '<p>No data found for selected filters. Please adjust your filters and try again.</p>';
        showToast('error', 'No data found for selected filters. Check that batches are approved.');
        return;
      }

      const cols = PREVIEW_COLS[activeReportType] || [];
      const title = REPORT_LABELS[activeReportType] || activeReportType;
      const summary = [
        selectedSeason ? `${selectedSeason} Season` : 'All Seasons',
        selectedYear || 'All Years',
        selectedBarangay ? `Brgy. ${selectedBarangay}` : 'All Barangays',
      ].join(' · ');

      const tableHeader = cols.map(col => `<th style="padding:8px 12px;border:1px solid #ddd;background:#f5f7fb;text-align:left;font-weight:700;">${col.label}</th>`).join('');
      const tableRows = rows.map(row => `
        <tr>${cols.map(col => {
          const value = row[col.key];
          if (col.key === 'data_sharing') {
            return `<td style="padding:8px 12px;border:1px solid #ddd;white-space:nowrap;">${value ? 'Yes' : 'No'}</td>`;
          }
          if (col.key === 'has_signature') {
            return `<td style="padding:8px 12px;border:1px solid #ddd;white-space:nowrap;">${value ? 'Signed' : 'Unsigned'}</td>`;
          }
          return `<td style="padding:8px 12px;border:1px solid #ddd;white-space:nowrap;">${value ?? '—'}</td>`;
        }).join('')}</tr>
      `).join('');

      const html = `
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #111827; }
              h1 { font-size: 22px; margin-bottom: 4px; }
              p { margin: 0 0 16px; color: #4b5563; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th, td { padding: 8px 12px; border: 1px solid #d1d5db; }
              th { background: #f3f4f6; text-align: left; }
              tbody tr:nth-child(odd) { background: #fff; }
              tbody tr:nth-child(even) { background: #f9fafb; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <p>${summary}</p>
            <table>
              <thead><tr>${tableHeader}</tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showToast('error', 'Unable to open the print window. Please check your popup settings.');
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      const errMsg = err.response?.data?.error
        || 'Failed to load report data for printing.';
      showToast('error', errMsg);
    } finally {
      setPrinting(false);
    }
  };

  // ─────────────────────────────────────────
  // PREVIEW FILTER — client-side search
  // ─────────────────────────────────────────
  const filteredPreviewRows = (previewData?.rows || []).filter(row => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.toLowerCase();
    return [row.last_name, row.first_name, row.rsbsa, row.barangay]
      .filter(Boolean)
      .some(v => v.toLowerCase().includes(q));
  });

  // Preview columns for the selected report type
  const previewCols = PREVIEW_COLS[activeReportType] || [];

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1200px', paddingBottom: '2rem' }}>
      <style>{`
        @keyframes toastIn {
          from { transform: translateX(-50%) translateY(24px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp {
          from { transform: translateY(14px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes modalIn {
          from { transform: scale(0.96) translateY(10px); opacity: 0; }
          to   { transform: scale(1)    translateY(0);    opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .rpt-card:hover {
          box-shadow: 0 6px 20px rgba(0,0,0,0.1) !important;
          transform: translateY(-2px);
          transition: all 0.2s;
        }
        .sub-btn:hover { opacity: 0.85; }
        .log-row:hover { background-color: ${GREEN.light} !important; }
      `}</style>

      <Toast toast={toast} />

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
          Reports
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
          Generate and download official DA masterlist and accomplishment reports.
        </p>
      </div>

      {/* ══════════════════════════════════════════
          STEP 1 — CHOOSE REPORT CATEGORY
      ══════════════════════════════════════════ */}
      <p style={{ fontWeight: 700, fontSize: '0.8rem', color: '#374151', margin: '0 0 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <FileText size={14} color={GREEN.primary} /> Step 1 — Select Report
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.875rem',
        marginBottom: '1.5rem',
      }}>
        {REPORT_CATEGORIES.map((cat, idx) => {
          const Icon = cat.icon;
          const selected = selectedCategory === cat.key;
          return (
            <div key={cat.key}
              className="rpt-card"
              onClick={() => {
                setSelectedCategory(cat.key);
                setSelectedSubtype('');   // Reset subtype on category change
                setPreviewOpen(false);
                setPreviewData(null);
              }}
              style={{
                backgroundColor: selected ? cat.bg : 'white',
                borderRadius: '1rem',
                padding: '1.125rem',
                border: `2px solid ${selected ? cat.color : '#e5e7eb'}`,
                cursor: 'pointer',
                boxShadow: selected
                  ? `0 4px 16px ${cat.color}22`
                  : '0 1px 4px rgba(0,0,0,0.06)',
                transition: 'all 0.2s',
                animation: `slideUp ${0.3 + idx * 0.06}s ease`,
              }}>
              {/* Category icon + title */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '0.625rem',
                  backgroundColor: selected ? cat.color : '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.2s',
                }}>
                  <Icon size={18} color={selected ? 'white' : '#9ca3af'} />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem', color: selected ? cat.color : '#1a1a1a', margin: '0 0 0.25rem' }}>
                    {cat.label}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                    {cat.description}
                  </p>
                </div>
              </div>

              {/* Subtype buttons — appear when category is selected */}
              {selected && cat.subtypes && (
                <div style={{ marginTop: '0.875rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', animation: 'fadeIn 0.2s ease' }}>
                  {cat.subtypes.map(sub => (
                    <button key={sub.key}
                      className="sub-btn"
                      onClick={e => { e.stopPropagation(); setSelectedSubtype(sub.key); }}
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.625rem',
                        border: `2px solid ${selectedSubtype === sub.key ? sub.color : '#e5e7eb'}`,
                        borderRadius: '0.625rem',
                        backgroundColor: selectedSubtype === sub.key ? sub.bg : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        textAlign: 'left',
                      }}>
                      <p style={{ fontWeight: 700, fontSize: '0.78rem', color: selectedSubtype === sub.key ? sub.color : '#374151', margin: 0 }}>
                        {sub.label}
                      </p>
                      <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                        {sub.desc}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* Checkmark for no-subtype selections */}
              {selected && !cat.subtypes && (
                <div style={{ marginTop: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <CheckCircle size={13} color={cat.color} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: cat.color }}>Selected</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════
          STEP 2 — FILTERS
      ══════════════════════════════════════════ */}
      <div style={{
        backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem',
        border: '1px solid #f3f4f6',
      }}>
        <p style={{ fontWeight: 700, fontSize: '0.8rem', color: '#374151', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Filter size={14} color={GREEN.primary} /> Step 2 — Filters
        </p>

        <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Season selector */}
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
              Season
            </label>
            <select
              value={selectedSeason}
              onChange={e => setSelectedSeason(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', backgroundColor: 'white', minWidth: '140px', color: '#374151', cursor: 'pointer' }}>
              <option value="">All Seasons</option>
              {filterOptions.seasons.map(s => (
                <option key={s} value={s}>
                  {s === 'WET' ? 'Wet Season' : 'Dry Season'}
                  {s === filterOptions.current_season ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Year selector — default is current FinalSeed year */}
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
              Year
            </label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', backgroundColor: 'white', minWidth: '120px', color: '#374151', cursor: 'pointer' }}>
              <option value="">All Years</option>
              {filterOptions.years.map(y => (
                <option key={y} value={y}>
                  {y}{y === filterOptions.current_year ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Barangay selector — optional for all reports */}
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
              Barangay
            </label>
            <select
              value={selectedBarangay}
              onChange={e => setSelectedBarangay(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', backgroundColor: 'white', minWidth: '160px', color: '#374151', cursor: 'pointer' }}>
              <option value="">All Barangays</option>
              {filterOptions.barangays.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.625rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
            {/* Preview button */}
            <button
              onClick={handlePreview}
              disabled={!selectedCategory || previewLoading}
              style={{
                padding: '0.5625rem 1.125rem',
                backgroundColor: !selectedCategory ? '#f3f4f6' : '#eff6ff',
                color: !selectedCategory ? '#9ca3af' : '#1e40af',
                border: `1.5px solid ${!selectedCategory ? '#e5e7eb' : '#bfdbfe'}`,
                borderRadius: '0.625rem',
                cursor: !selectedCategory ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.875rem',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                transition: 'all 0.15s',
              }}>
              {previewLoading
                ? <><Spinner size={14} color="#1e40af" /> Loading...</>
                : <><Eye size={14} /> Preview</>
              }
            </button>

            <button
              onClick={handlePrint}
              disabled={!selectedCategory || printing}
              style={{
                padding: '0.5625rem 1.25rem',
                backgroundColor: !selectedCategory || printing ? '#d1d5db' : '#f3f4f6',
                color: !selectedCategory || printing ? '#9ca3af' : '#111827',
                border: `1.5px solid ${!selectedCategory || printing ? '#e5e7eb' : '#d1d5db'}`,
                borderRadius: '0.625rem',
                cursor: !selectedCategory || printing ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.875rem',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                transition: 'all 0.15s',
              }}>
              {printing
                ? <><Spinner size={14} color="#111827" /> Printing...</>
                : <><Printer size={14} /> Print</>
              }
            </button>
            <button
              onClick={handleDownload}
              disabled={!selectedCategory || downloading}
              style={{
                padding: '0.5625rem 1.25rem',
                backgroundColor: !selectedCategory || downloading ? '#d1d5db' : GREEN.primary,
                color: 'white',
                border: 'none',
                borderRadius: '0.625rem',
                cursor: !selectedCategory || downloading ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.875rem',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                boxShadow: !selectedCategory || downloading
                  ? 'none'
                  : `0 3px 12px ${GREEN.primary}40`,
                transition: 'all 0.15s',
              }}>
              {downloading
                ? <><Spinner /> Generating...</>
                : <><Download size={14} /> Download Excel</>
              }
            </button>
          </div>
        </div>

        {/* Active filter summary pill */}
        {selectedCategory && (
          <div style={{
            marginTop: '0.875rem', padding: '0.625rem 0.875rem',
            backgroundColor: GREEN.light, borderRadius: '0.625rem',
            border: `1px solid ${GREEN.border}`,
            fontSize: '0.78rem', color: GREEN.accent,
            display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
            alignItems: 'center', animation: 'fadeIn 0.2s ease',
          }}>
            <span style={{ fontWeight: 700 }}>Generating:</span>
            <span style={{ backgroundColor: 'white', padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
              {activeSubCfg?.label
                ? `${activeCatCfg?.label} — ${activeSubCfg.label}`
                : activeCatCfg?.label
              }
            </span>
            {selectedSeason && (
              <span style={{ backgroundColor: 'white', padding: '0.1rem 0.5rem', borderRadius: '999px' }}>
                {selectedSeason === 'WET' ? 'Wet Season' : 'Dry Season'}
              </span>
            )}
            {selectedYear && (
              <span style={{ backgroundColor: 'white', padding: '0.1rem 0.5rem', borderRadius: '999px' }}>
                {selectedYear}
              </span>
            )}
            {selectedBarangay && (
              <span style={{ backgroundColor: 'white', padding: '0.1rem 0.5rem', borderRadius: '999px' }}>
                Brgy. {selectedBarangay}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          REPORT GENERATION HISTORY
      ══════════════════════════════════════════ */}
      <div style={{
        backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={15} color={GREEN.primary} /> Generation History
          </p>
          <button
            onClick={async () => {
              setLogsLoading(true);
              try {
                const res = await getReportLogs();
                setLogs(res.data || []);
              } catch { }
              finally { setLogsLoading(false); }
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: logsLoading ? 'spin 0.7s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {logs.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', padding: '1.5rem' }}>
            No reports generated yet.
          </p>
        ) : (
          <>
            {/* Log table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1.5fr 2fr',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.5rem',
              marginBottom: '0.25rem',
              fontSize: '0.65rem', fontWeight: 700,
              color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <span>Report</span>
              <span>Season</span>
              <span>Year</span>
              <span>Barangay</span>
              <span>Generated</span>
            </div>

            {logs.map((log, idx) => (
              <div key={log.id}
                className="log-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1.5fr 2fr',
                  padding: '0.625rem 0.75rem',
                  borderBottom: idx < logs.length - 1 ? '1px solid #f3f4f6' : 'none',
                  fontSize: '0.78rem',
                  alignItems: 'center',
                  borderRadius: '0.375rem',
                  animation: `fadeIn ${0.3 + idx * 0.03}s ease`,
                }}>
                <span>
                  <span style={{
                    backgroundColor: GREEN.light, color: GREEN.accent,
                    padding: '0.15rem 0.5rem', borderRadius: '999px',
                    fontSize: '0.68rem', fontWeight: 700,
                    border: `1px solid ${GREEN.border}`,
                  }}>
                    {REPORT_LABELS[log.report_type] || log.report_type}
                  </span>
                </span>
                <span style={{ color: '#374151' }}>{log.season || '—'}</span>
                <span style={{ color: '#374151' }}>{log.year || '—'}</span>
                <span style={{ color: '#374151' }}>{log.barangay || 'All'}</span>
                <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>
                  {new Date(log.generated_at).toLocaleDateString('en-PH', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                  {log.generated_by_name && (
                    <span style={{ display: 'block', color: '#d1d5db', fontSize: '0.65rem' }}>
                      by {log.generated_by_name}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════
          PREVIEW MODAL
          Opens as a full overlay with slide-up animation.
          Admin can search through rows before downloading.
      ══════════════════════════════════════════ */}
      {previewOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          zIndex: 400,
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '1.5rem 1rem',
          overflowY: 'auto',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1.25rem',
            width: '100%',
            maxWidth: '1100px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
            animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #f3f4f6',
              backgroundColor: GREEN.light,
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', gap: '1rem',
            }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.1rem', color: GREEN.accent, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Eye size={18} /> Data Preview
                </h2>
                <p style={{ fontSize: '0.78rem', color: GREEN.accent, opacity: 0.8, margin: '0.25rem 0 0' }}>
                  {activeSubCfg
                    ? `${activeCatCfg?.label} — ${activeSubCfg.label}`
                    : activeCatCfg?.label
                  }
                  {selectedSeason ? ` · ${selectedSeason} Season` : ''}
                  {selectedYear ? ` ${selectedYear}` : ''}
                  {selectedBarangay ? ` · Brgy. ${selectedBarangay}` : ''}
                </p>
                {previewData && !previewLoading && (
                  <p style={{ fontSize: '0.72rem', color: GREEN.accent, opacity: 0.7, margin: '0.125rem 0 0' }}>
                    {previewData.count} record{previewData.count !== 1 ? 's' : ''} found
                    {filteredPreviewRows.length !== previewData.count
                      ? ` · Showing ${filteredPreviewRows.length} after search`
                      : ''
                    }
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
                {/* Download directly from preview */}
                {previewData?.count > 0 && (
                  <button
                    onClick={() => { setPreviewOpen(false); handleDownload(); }}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: GREEN.primary, color: 'white',
                      border: 'none', borderRadius: '0.625rem',
                      cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                    }}>
                    <Download size={14} /> Download Excel
                  </button>
                )}
                <button
                  onClick={() => setPreviewOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Search bar inside modal */}
            {!previewLoading && previewData?.count > 0 && (
              <div style={{ padding: '0.875rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ position: 'relative', maxWidth: '360px' }}>
                  <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    value={previewSearch}
                    onChange={e => setPreviewSearch(e.target.value)}
                    placeholder="Search by name, RSBSA, or barangay..."
                    style={{
                      padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                      border: '1.5px solid #e5e7eb', borderRadius: '0.5rem',
                      fontSize: '0.875rem', width: '100%',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {previewSearch && (
                    <button
                      onClick={() => setPreviewSearch('')}
                      style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Modal body */}
            <div style={{ padding: '0', maxHeight: '65vh', overflowY: 'auto' }}>
              {previewLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                  <div style={{ width: 32, height: 32, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
                  Loading preview data...
                </div>
              ) : !previewData ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                  <AlertCircle size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
                  Failed to load preview.
                </div>
              ) : previewData.count === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                  <FileText size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
                  <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No data found</p>
                  <p style={{ fontSize: '0.875rem' }}>
                    No approved batches match these filters.
                    Ensure batches are approved in the Beneficiaries or Distribution menu.
                  </p>
                </div>
              ) : filteredPreviewRows.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                  No records match your search.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        {previewCols.map(col => (
                          <th key={col.key} style={{
                            padding: '0.625rem 0.875rem',
                            textAlign: 'left', fontWeight: 700,
                            color: '#374151', whiteSpace: 'nowrap',
                            fontSize: '0.7rem', textTransform: 'uppercase',
                            borderBottom: '2px solid #e5e7eb',
                            borderRight: '1px solid #f3f4f6',
                            backgroundColor: '#f9fafb',
                          }}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPreviewRows.slice(0, 100).map((row, idx) => (
                        <tr key={row.id} style={{
                          backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa',
                          borderBottom: '1px solid #f3f4f6',
                          animation: `fadeIn ${0.2 + idx * 0.01}s ease`,
                        }}>
                          {previewCols.map(col => (
                            <td key={col.key} style={{
                              padding: '0.5rem 0.875rem',
                              color: '#374151', whiteSpace: 'nowrap',
                              borderRight: '1px solid #f3f4f6',
                              fontSize: '0.78rem',
                            }}>
                              {/* Special formatting for boolean fields */}
                              {col.key === 'data_sharing'
                                ? (row[col.key] ? '✓' : '✗')
                                : col.key === 'has_signature'
                                  ? (row[col.key]
                                    ? <span style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.1rem 0.4rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, border: `1px solid ${GREEN.border}` }}>Signed</span>
                                    : <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.1rem 0.4rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700 }}>Unsigned</span>
                                  )
                                  : (row[col.key] ?? '—')
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredPreviewRows.length > 100 && (
                    <div style={{ padding: '0.75rem 1.5rem', backgroundColor: '#fef9c3', fontSize: '0.78rem', color: '#854d0e', borderTop: '1px solid #fde68a' }}>
                      Showing first 100 of {filteredPreviewRows.length} records. All records will be in the Excel file.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setPreviewOpen(false)}
                style={{ padding: '0.625rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.625rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                Close
              </button>
              {previewData?.count > 0 && (
                <button
                  onClick={() => { setPreviewOpen(false); handleDownload(); }}
                  disabled={downloading}
                  style={{
                    padding: '0.625rem 1.5rem',
                    backgroundColor: downloading ? '#d1d5db' : GREEN.primary,
                    color: 'white', border: 'none',
                    borderRadius: '0.625rem', cursor: downloading ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: '0.875rem',
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    boxShadow: downloading ? 'none' : `0 3px 10px ${GREEN.primary}40`,
                  }}>
                  {downloading
                    ? <><Spinner /> Generating...</>
                    : <><Download size={15} /> Confirm & Download Excel</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}