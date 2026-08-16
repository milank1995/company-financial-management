'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  limit,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startRange = (page - 1) * limit + 1;
  const endRange = Math.min(page * limit, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/20 mt-4 space-y-4 sm:space-y-0">
      <div className="text-sm text-slate-400">
        Showing <span className="font-semibold text-white">{startRange}</span> to{' '}
        <span className="font-semibold text-white">{endRange}</span> of{' '}
        <span className="font-semibold text-white">{totalItems}</span> records
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous Page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="text-sm text-slate-400 font-semibold px-4">
          Page <span className="text-white font-bold">{page}</span> of{' '}
          <span className="text-white font-bold">{totalPages}</span>
        </span>

        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next Page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
