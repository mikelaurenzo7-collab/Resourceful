import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

type RpcClient = Pick<SupabaseClient<Database>, 'rpc'>;

interface RpcError {
  message: string;
}

interface RpcResponse<TResult> {
  data: TResult | null;
  error: RpcError | null;
}

function callRpc<TArgs extends Record<string, unknown>, TResult>(
  client: RpcClient,
  functionName: string,
  args: TArgs
): Promise<RpcResponse<TResult>> {
  return client.rpc(functionName as never, args as never) as unknown as Promise<RpcResponse<TResult>>;
}

export function acquirePipelineLock(client: RpcClient, reportId: string) {
  return callRpc<{ p_report_id: string }, boolean>(client, 'acquire_pipeline_lock', {
    p_report_id: reportId,
  });
}

export function releasePipelineLock(client: RpcClient, reportId: string) {
  return callRpc<{ p_report_id: string }, boolean>(client, 'release_pipeline_lock', {
    p_report_id: reportId,
  });
}

export function incrementRateLimit(
  client: RpcClient,
  key: string,
  windowExpiresIso: string
) {
  return callRpc<{ p_key: string; p_window_expires: string }, number>(
    client,
    'increment_rate_limit',
    {
      p_key: key,
      p_window_expires: windowExpiresIso,
    }
  );
}