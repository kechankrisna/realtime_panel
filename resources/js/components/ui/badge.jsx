import * as React from 'react';
import { cn } from '@/lib/utils';

const Badge = ({ className, variant = 'default', ...props }) => (
    <div
        className={cn(
            'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            {
                'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80': variant === 'default',
                'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80': variant === 'destructive',
                'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
                'border-transparent bg-green-100 text-green-800': variant === 'success',
                'border-transparent bg-yellow-100 text-yellow-800': variant === 'warning',
                'text-foreground': variant === 'outline',
            },
            className
        )}
        {...props}
    />
);

export { Badge };
