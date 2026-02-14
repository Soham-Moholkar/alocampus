import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  subValue?: string;
  variant?: 'purple' | 'pink' | 'white' | 'default';
  className?: string;
  chip?: boolean; // Shows a little "SIM card" chip icon for the wallet look
}

export function StatCard({
  title,
  value,
  icon: Icon,
  subValue,
  variant = 'default',
  className,
  chip = false
}: StatCardProps) {

  const variants = {
    purple: 'bg-indigo-50 text-indigo-900',
    pink: 'bg-pink-50 text-pink-900',
    white: 'bg-white border border-gray-100 shadow-sm text-gray-900',
    default: 'bg-white border border-gray-100 shadow-sm text-gray-900',
  };

  const bgClass = variants[variant] || variants.default;

  return (
    <div className={cn('rounded-2xl p-6 relative overflow-hidden transition-all', bgClass, className)}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-medium opacity-80">{title}</h3>
        {Icon && (
          <div className="p-1.5 bg-black/5 rounded-full">
            <Icon className="w-4 h-4 opacity-70" />
          </div>
        )}
        {/* Three dots for the wallet look if no icon provided, or even with it */}
        {!Icon && <div className="text-lg font-bold leading-3 -mt-2">...</div>}
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {subValue && <div className="text-xs font-mono opacity-60">{subValue}</div>}
      </div>

      {chip && (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex -space-x-1">
            <div className="w-6 h-6 rounded-full bg-red-500/80"></div>
            <div className="w-6 h-6 rounded-full bg-yellow-500/80"></div>
          </div>
        </div>
      )}
    </div>
  );
}
