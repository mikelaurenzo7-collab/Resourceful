'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PropertyType, Report, CalibrationEntry, CalibrationParams } from '@/types/database';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TypeStat {
  propertyType: PropertyType;
  totalCompleted: number;
  meanAbsoluteErrorPct: number | null;
  medianErrorPct: number | null;
  biasDirection: string | null;
  sqftEntries: number;
  meanSqftBiasPct: number | null;
}

interface StatsData {
  totalCompleted: number;
  totalPending: number;
  statsByType: TypeStat[];
  params: CalibrationParams[];
  pendingEntries: CalibrationEntry[];
  recentCompleted: CalibrationEntry[];
}

type DeliveredReport = Pick<
  Report,
  'id' | 'property_address' | 'city' | 'state' | 'county' | 'property_type' | 'delivered_at'
>;

interface Props {
  deliveredReports: DeliveredReport[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return '--';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CalibrationDashboard({ deliveredReports }: Props) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'blind' | 'import' | 'pending' | 'stats'>('stats');

  // Blind valuation state
  const [blindAddress, setBlindAddress] = useState('');
  const [blindType, setBlindType] = useState<PropertyType>('residential');
  const [blindRunning, setBlindRunning] = useState(false);
  const [blindResult, setBlindResult] = useState<{
    calibrationId: string;
    concludedValue: number;
    compCount: number;
    attomBuildingSqft: number | null;
  } | null>(null);

  // Complete entry state
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeValue, setCompleteValue] = useState('');
  const [completeSqft, setCompleteSqft] = useState('');

  // Import state
  const [importValues, setImportValues] = useState<Record<string, { value: string; sqft: string }>>({});
  const [importing, setImporting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/calibration/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // silently fail on stats fetch
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Blind Valuation ─────────────────────────────────────────────────────

  async function runBlindValuation() {
    if (!blindAddress.trim()) return;
    setBlindRunning(true);
    setError(null);
    setBlindResult(null);

    try {
      const res = await fetch('/api/admin/calibration/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: blindAddress, propertyType: blindType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to run valuation');
      } else {
        setBlindResult(data);
        setSuccess(`System concluded value: ${formatCurrency(data.concludedValue)} (${data.compCount} comps)`);
        fetchStats();
      }
    } catch {
      setError('Network error');
    } finally {
      setBlindRunning(false);
    }
  }

  // ── Complete Entry ──────────────────────────────────────────────────────

  async function submitActualValue(calibrationId: string) {
    const val = parseInt(completeValue, 10);
    if (!val || val <= 0) { setError('Enter a valid appraised value'); return; }

    setError(null);
    try {
      const res = await fetch('/api/admin/calibration/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calibrationId,
          actualAppraisedValue: val,
          actualBuildingSqft: completeSqft ? parseFloat(completeSqft) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to complete entry');
      } else {
        setSuccess(`Recorded. Variance: ${formatCurrency(data.varianceDollars)} (${formatPct(data.variancePct)})`);
        setCompletingId(null);
        setCompleteValue('');
        setCompleteSqft('');
        fetchStats();
      }
    } catch {
      setError('Network error');
    }
  }

  // ── Bulk Import ─────────────────────────────────────────────────────────

  async function runBulkImport() {
    const entries = Object.entries(importValues)
      .filter(([, v]) => v.value && parseInt(v.value, 10) > 0)
      .map(([reportId, v]) => ({
        reportId,
        actualAppraisedValue: parseInt(v.value, 10),
        actualBuildingSqft: v.sqft ? parseFloat(v.sqft) : undefined,
      }));

    if (entries.length === 0) { setError('Enter at least one appraised value'); return; }

    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/calibration/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Import failed');
      } else {
        setSuccess(`Imported ${data.imported} entries (${data.failed} failed)`);
        setImportValues({});
        fetchStats();
      }
    } catch {
      setError('Network error');
    } finally {
      setImporting(false);
    }
  }

  // ── Recalculate ─────────────────────────────────────────────────────────

  async function triggerRecalculate() {
    setError(null);
    try {
      const res = await fetch('/api/admin/calibration/recalculate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Recalculation failed');
      } else {
        setSuccess(`Updated ${data.updated} parameter sets`);
        fetchStats();
      }
    } catch {
      setError('Network error');
    }
  }

  if (loading) {
    return <div className="text-gray-500">Loading calibration data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">dismiss</button>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 font-medium underline">dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {([
          ['stats', 'Accuracy Stats'],
          ['blind', 'New Blind Valuation'],
          ['import', 'Bulk Import'],
          ['pending', `Pending (${stats?.totalPending ?? 0})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Stats Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'stats' && stats && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Completed</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalCompleted}</p>
              <p className="mt-1 text-sm text-gray-500">calibration entries</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Pending</p>
              <p className="mt-2 text-3xl font-bold text-amber-600">{stats.totalPending}</p>
              <p className="mt-1 text-sm text-gray-500">awaiting actual values</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Param Sets</p>
              <p className="mt-2 text-3xl font-bold text-blue-600">{stats.params.length}</p>
              <p className="mt-1 text-sm text-gray-500">calibrated</p>
            </div>
          </div>

          {/* Per-type accuracy */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Accuracy by Property Type</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-2 text-left font-medium text-gray-500">Type</th>
                    <th className="px-5 py-2 text-right font-medium text-gray-500">Entries</th>
                    <th className="px-5 py-2 text-right font-medium text-gray-500">MAE</th>
                    <th className="px-5 py-2 text-right font-medium text-gray-500">Bias</th>
                    <th className="px-5 py-2 text-right font-medium text-gray-500">Sqft Samples</th>
                    <th className="px-5 py-2 text-right font-medium text-gray-500">Sqft Bias</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.statsByType.map(st => (
                    <tr key={st.propertyType} className="border-b border-gray-50">
                      <td className="px-5 py-2.5 font-medium capitalize text-gray-900">{st.propertyType}</td>
                      <td className="px-5 py-2.5 text-right text-gray-700">{st.totalCompleted}</td>
                      <td className="px-5 py-2.5 text-right text-gray-700">
                        {st.meanAbsoluteErrorPct != null ? `${st.meanAbsoluteErrorPct.toFixed(1)}%` : '--'}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {st.biasDirection ? (
                          <span className={st.biasDirection === 'overvalues' ? 'text-red-600' : 'text-blue-600'}>
                            {st.biasDirection} ({formatPct(st.medianErrorPct)})
                          </span>
                        ) : '--'}
                      </td>
                      <td className="px-5 py-2.5 text-right text-gray-700">{st.sqftEntries}</td>
                      <td className="px-5 py-2.5 text-right text-gray-700">
                        {st.meanSqftBiasPct != null ? formatPct(st.meanSqftBiasPct) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Current params */}
          {stats.params.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Active Calibration Parameters</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Scope</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Size x</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Cond x</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Mkt x</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Land x</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Bias</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Sqft Corr</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.params.map(p => (
                      <tr key={p.id} className="border-b border-gray-50">
                        <td className="px-4 py-2 font-medium capitalize text-gray-900">
                          {p.property_type}{p.county_fips ? ` (${p.county_fips})` : ' (global)'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">{p.size_multiplier.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{p.condition_multiplier.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{p.market_trend_multiplier.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{p.land_ratio_multiplier.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{formatPct(p.value_bias_pct)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{p.sqft_correction_factor.toFixed(3)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{p.sample_size}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recalculate button */}
          <button
            onClick={triggerRecalculate}
            disabled={stats.totalCompleted < 5}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Recalculate Parameters ({stats.totalCompleted} entries)
          </button>
          {stats.totalCompleted < 5 && (
            <span className="ml-3 text-sm text-gray-500">
              Need at least 5 completed entries to calibrate
            </span>
          )}

          {/* Recent completed */}
          {stats.recentCompleted.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Recent Completed Entries</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Address</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">System</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Actual</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentCompleted.map(e => (
                      <tr key={e.id} className="border-b border-gray-50">
                        <td className="max-w-[200px] truncate px-4 py-2 text-gray-900">{e.property_address}</td>
                        <td className="px-4 py-2 capitalize text-gray-700">{e.property_type}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(e.system_concluded_value)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(e.actual_appraised_value)}</td>
                        <td className={`px-4 py-2 text-right font-medium ${
                          e.variance_pct != null && Math.abs(e.variance_pct) > 10 ? 'text-red-600' : 'text-gray-700'
                        }`}>
                          {formatPct(e.variance_pct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Blind Valuation Tab ──────────────────────────────────────────── */}
      {activeTab === 'blind' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Run Blind Valuation</h3>
          <p className="mb-4 text-sm text-gray-500">
            Enter a property address. The system will pull ATTOM data, find comps,
            and calculate a concluded value. You then reveal the actual appraised value.
          </p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Property Address</label>
              <input
                type="text"
                value={blindAddress}
                onChange={(e) => setBlindAddress(e.target.value)}
                placeholder="123 Main St, City, ST 12345"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Property Type</label>
              <select
                value={blindType}
                onChange={(e) => setBlindType(e.target.value as PropertyType)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="residential">Residential</option>
                <option value="land">Land</option>
              </select>
            </div>
            <button
              onClick={runBlindValuation}
              disabled={blindRunning || !blindAddress.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {blindRunning ? 'Running...' : 'Run Blind Valuation'}
            </button>
          </div>

          {blindResult && (
            <div className="mt-6 rounded-lg bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">
                System Concluded Value: {formatCurrency(blindResult.concludedValue)}
              </p>
              <p className="text-sm text-blue-700">
                Based on {blindResult.compCount} comps | ATTOM sqft: {blindResult.attomBuildingSqft?.toLocaleString() ?? 'N/A'}
              </p>
              <p className="mt-2 text-sm text-blue-700">
                Go to the Pending tab to enter the actual appraised value.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Bulk Import Tab ──────────────────────────────────────────────── */}
      {activeTab === 'import' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Import from Delivered Reports ({deliveredReports.length} available)
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Enter your company&apos;s appraised values and field-measured sqft for these properties. Zero API cost.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Address</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
                  <th className="w-36 px-4 py-2 text-right font-medium text-gray-500">Appraised Value ($)</th>
                  <th className="w-28 px-4 py-2 text-right font-medium text-gray-500">Actual Sqft</th>
                </tr>
              </thead>
              <tbody>
                {deliveredReports.map(r => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="max-w-[250px] truncate px-4 py-2 text-gray-900">
                      {r.property_address}
                      {r.city && <span className="text-gray-500">, {r.city}</span>}
                    </td>
                    <td className="px-4 py-2 capitalize text-gray-700">{r.property_type}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        placeholder="325000"
                        value={importValues[r.id]?.value ?? ''}
                        onChange={(e) => setImportValues(prev => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], value: e.target.value, sqft: prev[r.id]?.sqft ?? '' },
                        }))}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        placeholder="2400"
                        value={importValues[r.id]?.sqft ?? ''}
                        onChange={(e) => setImportValues(prev => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], value: prev[r.id]?.value ?? '', sqft: e.target.value },
                        }))}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-200 px-5 py-3">
            <button
              onClick={runBulkImport}
              disabled={importing || Object.values(importValues).filter(v => v.value).length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${Object.values(importValues).filter(v => v.value).length} Entries`}
            </button>
          </div>
        </div>
      )}

      {/* ── Pending Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'pending' && stats && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Pending Entries ({stats.pendingEntries.length})
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Enter the actual appraised value for each property to complete calibration.
            </p>
          </div>
          {stats.pendingEntries.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-gray-500">
              No pending entries. Run a blind valuation to create one.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.pendingEntries.map(entry => (
                <div key={entry.id} className="px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{entry.property_address}</p>
                      <p className="text-sm text-gray-500">
                        {entry.property_type} | {entry.comp_count} comps | ATTOM sqft: {entry.attom_building_sqft?.toLocaleString() ?? 'N/A'}
                      </p>
                      <p className="mt-1 text-lg font-bold text-blue-700">
                        System: {formatCurrency(entry.system_concluded_value)}
                      </p>
                    </div>
                    {completingId === entry.id ? (
                      <div className="flex items-end gap-2">
                        <div>
                          <label className="mb-1 block text-xs text-gray-500">Appraised Value ($)</label>
                          <input
                            type="number"
                            value={completeValue}
                            onChange={(e) => setCompleteValue(e.target.value)}
                            placeholder="325000"
                            className="w-32 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-gray-500">Actual Sqft</label>
                          <input
                            type="number"
                            value={completeSqft}
                            onChange={(e) => setCompleteSqft(e.target.value)}
                            placeholder="2400"
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={() => submitActualValue(entry.id)}
                          className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700"
                        >
                          Submit
                        </button>
                        <button
                          onClick={() => { setCompletingId(null); setCompleteValue(''); setCompleteSqft(''); }}
                          className="rounded bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCompletingId(entry.id)}
                        className="rounded bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200"
                      >
                        Enter Actual Value
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
