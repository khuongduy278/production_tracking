import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'urgent' | 'soon' | 'normal' | 'late' | 'done';
  className?: string;
  children?: React.ReactNode;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: "bg-slate-100 text-slate-500",
    urgent: "bg-orange-500 text-white",
    late: "bg-rose-600 text-white",
    soon: "bg-amber-100 text-amber-700",
    normal: "bg-emerald-100 text-emerald-700",
    done: "bg-slate-100 text-slate-500"
  };

  return (
    <span 
      className={cn("inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider", variants[variant], className)} 
      {...props} 
    />
  );
}
