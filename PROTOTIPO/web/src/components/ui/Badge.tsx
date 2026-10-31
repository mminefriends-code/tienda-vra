import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils.js';

export type BadgeVariant = 'brand' | 'success' | 'danger' | 'warning' | 'neutral' | 'accent';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  brand: 'bg-[#C0D0EF]/35 text-[#0F1C30] border-[#C0D0EF]',
  success: 'bg-success-50 text-success-700 border-success-200',
  danger: 'bg-danger-50 text-danger-700 border-danger-200',
  warning: 'bg-warning-50 text-amber-700 border-amber-200',
  neutral: 'bg-ink-100 text-ink-700 border-ink-200',
  accent: 'bg-[#668DC0]/20 text-[#304A6E] border-[#668DC0]/40',
};

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}