import { createClient } from '@supabase/supabase-js';
const sb = createClient('http://127.0.0.1:54321', 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz');
const { data: report } = await sb.from('reports')
  .select('status,pipeline_last_completed_stage,pipeline_error_log,report_pdf_storage_path')
  .eq('id','a3f77c12-d001-4e88-bc44-000000000931')
  .single();
console.log('REPORT:', JSON.stringify(report, null, 2));
const { data: sections } = await sb.from('report_narratives')
  .select('section_name')
  .eq('report_id','a3f77c12-d001-4e88-bc44-000000000931')
  .order('section_name');
console.log('SECTIONS:', sections?.map(s => s.section_name).join(', '));

const { data: comps, error: compsError } = await sb.from('comparable_sales')
  .select('address,sale_price,sale_date,building_sqft,price_per_sqft,adjusted_price_per_sqft,net_adjustment_pct,distance_miles')
  .eq('report_id','a3f77c12-d001-4e88-bc44-000000000931')
  .order('sale_price');
if (compsError) console.log('COMPS ERROR:', compsError.message);
else {
  console.log('COMPS (' + comps.length + '):');
  comps.forEach(c => console.log(`  ${c.address} | $${c.sale_price.toLocaleString()} | ${c.sale_date} | ${c.building_sqft}sqft | $${c.price_per_sqft}/sqft | net_adj: ${c.net_adjustment_pct}% | adj_$/sqft: $${c.adjusted_price_per_sqft} | ${c.distance_miles}mi`));
}

const { data: pd, error: pde } = await sb.from('property_data')
  .select('building_sqft_living_area,building_sqft_gross,year_built,bedroom_count,full_bath_count,lot_size_sqft,assessed_value,market_value_estimate_low,market_value_estimate_high,assessment_ratio')
  .eq('report_id','a3f77c12-d001-4e88-bc44-000000000931')
  .single();
if (pde) console.log('PROPERTY DATA ERROR:', pde.message);
else console.log('SUBJECT PROPERTY:', JSON.stringify(pd));
