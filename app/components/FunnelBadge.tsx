'use client';

interface FunnelBadgeProps {
  funnel: string | null;
}

export default function FunnelBadge({ funnel }: FunnelBadgeProps) {
  if (!funnel) return <span className="text-gray-400">-</span>;

  const getBadgeStyle = () => {
    switch (funnel.toUpperCase()) {
      case 'HD':
        return 'bg-green-500 text-white';
      case 'LD':
        return 'bg-blue-500 text-white';
      case 'DP':
        return 'bg-yellow-500 text-gray-900';
      case 'RS':                              // ← ADD THIS
        return 'bg-emerald-500 text-white';   // ← ADD THIS
      default:
        return 'bg-gray-400 text-white';
    }
  };

  return (
    <span
      className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-sm font-bold ${getBadgeStyle()}`}
    >
      {funnel.toUpperCase()}
    </span>
  );
}
