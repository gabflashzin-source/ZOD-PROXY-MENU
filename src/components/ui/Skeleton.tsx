import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return <div className={`animate-pulse bg-neutral-200 dark:bg-[#1C1C1C] rounded-md ${className}`} />;
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 5 }) => {
  return (
    <div className="w-full divide-y divide-[#E8E8E8] dark:divide-[#252525] border border-[#E8E8E8] dark:border-[#252525] rounded-xl overflow-hidden bg-white dark:bg-[#111111]">
      <div className="bg-neutral-50 dark:bg-[#161616] p-3.5 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="p-3.5 flex gap-4 bg-white dark:bg-[#111111]">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};
