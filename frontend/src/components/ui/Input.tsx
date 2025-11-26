import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      helperText,
      fullWidth = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'rounded-lg border bg-background-default px-4 py-2 text-base text-text-primary transition-all duration-200 placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
    
    const errorStyles = error
      ? 'border-error-500 focus:border-error-500 focus:ring-error-500'
      : 'border-border-default focus:border-primary-blueHighlight focus:ring-primary-blueHighlight';
    
    const widthClass = fullWidth ? 'w-full' : '';
    
    return (
      <div className={cn('flex flex-col space-y-1.5', widthClass)}>
        {label && (
          <label className="text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(baseStyles, errorStyles, widthClass, className)}
          ref={ref}
          disabled={disabled}
          {...props}
        />
        {error && (
          <p className="text-sm text-error-500">{error}</p>
        )}
        {helperText && !error && (
          <p className="text-sm text-text-tertiary">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
