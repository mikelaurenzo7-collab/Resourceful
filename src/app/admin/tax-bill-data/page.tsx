import { createClient } from '@/lib/supabase/server';

// ─── Tax Bill Intelligence Dashboard ────────────────────────────────────────
// Aggregates and visualizes tax bill data uploaded by users.
// Surfaces trends by county, state, property type, and time period.

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents);
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

function StatCard({ label, value, subtitle, color = 'text-gray-900' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface TaxBillReport {
  id: string;
  created_at: string;
  property_address: string;
  city: string | null;
  state: string | null;
  county: string | null;
  property_type: string;
  tax_bill_assessed_value: number | null;
  tax_bill_tax_amount: number | null;
  tax_bill_tax_year: string | null;
  amount_paid_cents: number | null;
  status: string;
}

interface CountyAggregate {
  county: string;
  state: string;
  count: number;
  avgAssessedValue: number;
  avgTaxAmount: number;
  avgEffectiveTaxRate: number;
  totalRevenue: number;
}

interface StateAggregate {
  state: string;
  count: number;
  avgAssessedValue: number;
  avgTaxRate: number;
}

interface MonthlyTrend {
  month: string;
  count: number;
  avgAssessedValue: number;
}

export default async function TaxBillDataPage() {
  const supabase = await createClient();

  // Fetch all reports with tax bill data
  const { data: rawReports } = await supabase
    .from('reports')
    .select(
      'id, created_at, property_address, city, state, county, property_type, ' +
      'tax_bill_assessed_value, tax_bill_tax_amount, tax_bill_tax_year, ' +
      'amount_paid_cents, status'
    )
    .eq('has_tax_bill', true)
    .not('tax_bill_assessed_value', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  const reports = (rawReports as unknown as TaxBillReport[] | null) ?? [];

  // ── Summary Stats ──────────────────────────────────────────────────────
  const totalReports = reports.length;
  const totalRevenue = reports.reduce((sum, r) => sum + (r.amount_paid_cents ?? 0), 0);
  const avgAssessedValue =
    totalReports > 0
      ? reports.reduce((sum, r) => sum + (r.tax_bill_assessed_value ?? 0), 0) / totalReports
      : 0;

  const reportsWithTax = reports.filter(
    (r) => r.tax_bill_tax_amount && r.tax_bill_assessed_value && r.tax_bill_assessed_value > 0
  );
  const avgEffectiveTaxRate =
    reportsWithTax.length > 0
      ? reportsWithTax.reduce(
          (sum, r) => sum + (r.tax_bill_tax_amount! / r.tax_bill_assessed_value!),
          0
        ) / reportsWithTax.length
      : 0;

  const uniqueStates = new Set(reports.map((r) => r.state).filter(Boolean));
  const uniqueCounties = new Set(
    reports.map((r) => `${r.county}-${r.state}`).filter((s) => !s.startsWith('null'))
  );

  // ── County Aggregation ────────────────────────────────────────────────
  const countyMap = new Map<string, TaxBillReport[]>();
  for (const r of reports) {
    if (r.county && r.state) {
      const key = `${r.county}, ${r.state}`;
      if (!countyMap.has(key)) countyMap.set(key, []);
      countyMap.get(key)!.push(r);
    }
  }

  const countyAggregates: CountyAggregate[] = Array.from(countyMap.entries())
    .map(([key, reps]) => {
      const [county, state] = key.split(', ');
      const withTax = reps.filter(
        (r) => r.tax_bill_tax_amount && r.tax_bill_assessed_value && r.tax_bill_assessed_value > 0
      );
      return {
        county,
        state,
        count: reps.length,
        avgAssessedValue:
          reps.reduce((s, r) => s + (r.tax_bill_assessed_value ?? 0), 0) / reps.length,
        avgTaxAmount:
          withTax.length > 0
            ? withTax.reduce((s, r) => s + (r.tax_bill_tax_amount ?? 0), 0) / withTax.length
            : 0,
        avgEffectiveTaxRate:
          withTax.length > 0
            ? withTax.reduce(
                (s, r) => s + (r.tax_bill_tax_amount! / r.tax_bill_assessed_value!),
                0
              ) / withTax.length
            : 0,
        totalRevenue: reps.reduce((s, r) => s + (r.amount_paid_cents ?? 0), 0),
      };
    })
    .sort((a, b) => b.count - a.count);

  // ── State Aggregation ─────────────────────────────────────────────────
  const stateMap = new Map<string, TaxBillReport[]>();
  for (const r of reports) {
    if (r.state) {
      if (!stateMap.has(r.state)) stateMap.set(r.state, []);
      stateMap.get(r.state)!.push(r);
    }
  }

  const stateAggregates: StateAggregate[] = Array.from(stateMap.entries())
    .map(([state, reps]) => {
      const withTax = reps.filter(
        (r) => r.tax_bill_tax_amount && r.tax_bill_assessed_value && r.tax_bill_assessed_value > 0
      );
      return {
        state,
        count: reps.length,
        avgAssessedValue:
          reps.reduce((s, r) => s + (r.tax_bill_assessed_value ?? 0), 0) / reps.length,
        avgTaxRate:
          withTax.length > 0
            ? withTax.reduce(
                (s, r) => s + (r.tax_bill_tax_amount! / r.tax_bill_assessed_value!),
                0
              ) / withTax.length
            : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  // ── Monthly Trends ────────────────────────────────────────────────────
  const monthMap = new Map<string, TaxBillReport[]>();
  for (const r of reports) {
    const month = r.created_at.slice(0, 7); // YYYY-MM
    if (!monthMap.has(month)) monthMap.set(month, []);
    monthMap.get(month)!.push(r);
  }

  const monthlyTrends: MonthlyTrend[] = Array.from(monthMap.entries())
    .map(([month, reps]) => ({
      month,
      count: reps.length,
      avgAssessedValue:
        reps.reduce((s, r) => s + (r.tax_bill_assessed_value ?? 0), 0) / reps.length,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // ── Property Type Breakdown ───────────────────────────────────────────
  const typeMap = new Map<string, number>();
  for (const r of reports) {
    typeMap.set(r.property_type, (typeMap.get(r.property_type) ?? 0) + 1);
  }
  const propertyTypeBreakdown = Array.from(typeMap.entries())
    .sort((a, b) => b[1] - a[1]);

  // ── Tax Year Distribution ─────────────────────────────────────────────
  const yearMap = new Map<string, number>();
  for (const r of reports) {
    if (r.tax_bill_tax_year) {
      yearMap.set(r.tax_bill_tax_year, (yearMap.get(r.tax_bill_tax_year) ?? 0) + 1);
    }
  }
  const taxYearBreakdown = Array.from(yearMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tax Bill Intelligence</h1>
        <p className="mt-1 text-sm text-gray-500">
          Aggregated assessment data from user-uploaded tax bills. Use for model training, trend analysis, and market insights.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <StatCard
          label="Tax Bills Collected"
          value={totalReports}
          subtitle={`${uniqueStates.size} states, ${uniqueCounties.size} counties`}
          color="text-[#1a2744]"
        />
        <StatCard
          label="Avg Assessed Value"
          value={formatCurrency(avgAssessedValue)}
          subtitle="Across all uploads"
        />
        <StatCard
          label="Avg Effective Tax Rate"
          value={formatPct(avgEffectiveTaxRate)}
          subtitle={`${reportsWithTax.length} bills with tax amount`}
          color={avgEffectiveTaxRate > 0.025 ? 'text-amber-600' : 'text-[#1a2744]'}
        />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <StatCard
          label="Revenue from Tax Bill Users"
          value={formatCurrency(totalRevenue / 100)}
          subtitle="15% discount applied"
          color="text-green-700"
        />
        <StatCard
          label="Property Types"
          value={propertyTypeBreakdown.length}
          subtitle={propertyTypeBreakdown.map(([t, c]) => `${t}: ${c}`).join(', ')}
        />
        <StatCard
          label="Tax Years Covered"
          value={taxYearBreakdown.length}
          subtitle={taxYearBreakdown.map(([y, c]) => `${y}: ${c}`).join(', ')}
        />
      </div>

      {/* Monthly Trend */}
      {monthlyTrends.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-gray-900">Monthly Upload Trend</h2>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Month</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Uploads</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Avg Assessed Value</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyTrends.map((m, i) => {
                  const prev = i > 0 ? monthlyTrends[i - 1] : null;
                  const change = prev ? ((m.count - prev.count) / prev.count) * 100 : 0;
                  return (
                    <tr key={m.month} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.month}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-[#1a2744]">{m.count}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(m.avgAssessedValue)}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {prev ? (
                          <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {change >= 0 ? '+' : ''}{change.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* State Breakdown */}
      {stateAggregates.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-gray-900">By State</h2>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">State</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Bills</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Avg Assessed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Avg Tax Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stateAggregates.map((s) => (
                  <tr key={s.state} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.state}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-[#1a2744]">{s.count}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(s.avgAssessedValue)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {s.avgTaxRate > 0 ? formatPct(s.avgTaxRate) : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* County Breakdown */}
      {countyAggregates.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-gray-900">By County</h2>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">County</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">State</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Bills</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Avg Assessed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Avg Tax</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Eff. Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {countyAggregates.slice(0, 50).map((c) => (
                  <tr key={`${c.county}-${c.state}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.county}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.state}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-[#1a2744]">{c.count}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(c.avgAssessedValue)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {c.avgTaxAmount > 0 ? formatCurrency(c.avgTaxAmount) : '--'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {c.avgEffectiveTaxRate > 0 ? formatPct(c.avgEffectiveTaxRate) : '--'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-green-700 font-medium">
                      {formatCurrency(c.totalRevenue / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {countyAggregates.length > 50 && (
            <p className="mt-2 text-xs text-gray-400 text-right">
              Showing top 50 of {countyAggregates.length} counties
            </p>
          )}
        </section>
      )}

      {/* Recent Uploads Table */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Recent Tax Bill Uploads</h2>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">County</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Assessed</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Tax</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Year</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.slice(0, 100).map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate">
                    {r.property_address}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {r.county ? `${r.county}, ${r.state}` : r.state}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 capitalize">{r.property_type}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                    {r.tax_bill_assessed_value ? formatCurrency(r.tax_bill_assessed_value) : '--'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {r.tax_bill_tax_amount ? formatCurrency(r.tax_bill_tax_amount) : '--'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">
                    {r.tax_bill_tax_year ?? '--'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      r.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      r.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                      r.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {reports.length > 100 && (
          <p className="mt-2 text-xs text-gray-400 text-right">
            Showing 100 of {reports.length} uploads
          </p>
        )}
      </section>

      {/* Empty State */}
      {totalReports === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-gray-900">No tax bill data yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Tax bill uploads will appear here as users complete the intake flow.
          </p>
        </div>
      )}
    </div>
  );
}
