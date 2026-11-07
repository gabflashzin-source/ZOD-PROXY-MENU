import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightElement, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-[#111111] dark:text-neutral-200">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-[#888888] dark:text-[#707070] pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-white dark:bg-[#111111] text-[#111111] dark:text-[#FFFFFF] placeholder:text-[#888888] dark:placeholder:text-[#707070] border rounded-lg text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#111111] dark:focus:ring-white focus:border-[#111111] dark:focus:border-white min-h-[38px] px-3.5 py-2 ${
              leftIcon ? 'pl-9' : ''
            } ${rightElement ? 'pr-10' : ''} ${
              error
                ? 'border-red-500 focus:border-red-500 dark:border-red-500'
                : 'border-[#E8E8E8] dark:border-[#252525]'
            } ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 text-[#888888] dark:text-[#707070] flex items-center justify-center">
              {rightElement}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-mono">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#666666] dark:text-[#707070] leading-relaxed">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: { label: string; value: string | number }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-[#111111] dark:text-neutral-200">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full bg-white dark:bg-[#111111] text-[#111111] dark:text-[#FFFFFF] border rounded-lg text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#111111] dark:focus:ring-white focus:border-[#111111] dark:focus:border-white min-h-[38px] px-3.5 py-2 cursor-pointer ${
            error ? 'border-red-500' : 'border-[#E8E8E8] dark:border-[#252525]'
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#111111] text-[#111111] dark:text-[#FFFFFF] py-1">
              {opt.label}
            </option>
          ))}
        </select>
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400 font-mono">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#666666] dark:text-[#707070]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, rows = 3, ...props }, ref) => {
    const areaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={areaId} className="block text-xs font-medium text-[#111111] dark:text-neutral-200">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          id={areaId}
          ref={ref}
          rows={rows}
          className={`w-full bg-white dark:bg-[#111111] text-[#111111] dark:text-[#FFFFFF] placeholder:text-[#888888] dark:placeholder:text-[#707070] border rounded-lg text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#111111] dark:focus:ring-white focus:border-[#111111] dark:focus:border-white px-3.5 py-2 ${
            error ? 'border-red-500' : 'border-[#E8E8E8] dark:border-[#252525]'
          } ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400 font-mono">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#666666] dark:text-[#707070]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
