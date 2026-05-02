import type { ReportStatus } from '@/types/database';

const statusConfig: Record<ReportStatus, { label: string; className: string }> = {
  intake: { label: 'Intake', className: 'bg-gray-500/15 text-gray-400 border border-gray-500/20' },
  paid: { label: 'Paid', className: 'bg-blue-500/15 text-blue-400 border border-blue-500/20' },
  data_pull: { label: 'Data Pull', className: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' },
  photo_pending: { label: 'Photos', className: 'bg-purple-500/15 text-purple-400 border border-purple-500/20' },
  processing: { label: 'Processing', className: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' },
  pending_approval: { label: 'Pending', className: 'bg-amber-500/15 text-amber-400 border border-amber-500/20' },
  approved: { label: 'Approved', className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' },
  delivering: { label: 'Delivering', className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' },
  delivered: { label: 'Delivered', className: 'bg-green-500/15 text-green-400 border border-green-500/20' },
  rejected: { label: 'Rejected', className: 'bg-red-500/15 text-red-400 border border-red-500/20' },
  failed: { label: 'Failed', className: 'bg-red-500/20 text-red-300 border border-red-500/25' },
};

export default function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-gray-500/15 text-gray-400 border border-gray-500/20' };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
