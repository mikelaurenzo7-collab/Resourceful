import type { ReportStatus } from '@/types/database';

const statusConfig: Record<ReportStatus, { label: string; className: string }> = {
  intake: { label: 'Intake', className: 'bg-gray-100 text-gray-700' },
  paid: { label: 'Paid', className: 'bg-blue-100 text-blue-700' },
  data_pull: { label: 'Data Pull', className: 'bg-indigo-100 text-indigo-700' },
  photo_pending: { label: 'Photo Pending', className: 'bg-purple-100 text-purple-700' },
  processing: { label: 'Processing', className: 'bg-cyan-100 text-cyan-700' },
  pending_approval: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  failed: { label: 'Failed', className: 'bg-red-200 text-red-900' },
};

export default function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
