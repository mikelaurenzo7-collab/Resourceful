import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { CountyRule } from '@/types/database';
import CountyEditForm from './CountyEditForm';

async function getCounty(fips: string): Promise<CountyRule | null> {
  if (fips === 'new') return null;

  const supabase = await createClient();

  const { data: result } = await supabase
    .from('county_rules')
    .select('*')
    .eq('county_fips', fips)
    .single();

  return (result as unknown as CountyRule) ?? null;
}

export default async function CountyEditPage({
  params,
}: {
  params: { fips: string };
}) {
  const county = await getCounty(params.fips);
  const isNew = params.fips === 'new';

  if (!isNew && !county) {
    notFound();
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">
          {isNew ? 'Add County' : `Edit: ${county!.county_name}, ${county!.state_abbreviation}`}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isNew
            ? 'Configure assessment rules and appeal information for a new county.'
            : 'Update county assessment rules and appeal information.'}
        </p>
      </div>

      <CountyEditForm county={county} isNew={isNew} />
    </div>
  );
}
