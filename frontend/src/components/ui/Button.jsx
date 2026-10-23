import { memo } from 'react';

const variantStyles = {
  primary: 'bg-[#BD715C] text-white hover:bg-[#A85F4D] active:bg-[#965242] shadow-[0_4px_14px_rgba(189,113,92,0.25)] hover:shadow-[0_6px_20px_rgba(189,113,92,0.35)] hover:-translate-y-0.5',
  secondary: 'bg-white text-[#292B29] border border-[#E6DED6] hover:bg-[#F3DED6]/40 hover:border-[#BD715C]/40 shadow-xs hover:-translate-y-0.5',
  outline: 'bg-transparent border border-[#BD715C] text-[#BD715C] hover:bg-[#BD715C] hover:text-white shadow-xs hover:-translate-y-0.5',
  ghost: 'bg-transparent text-[#292B29] hover:bg-[#F3DED6]/40 hover:text-[#BD715C]',
  sage: 'bg-[#7D9588] text-white hover:bg-[#6C8376] shadow-xs hover:-translate-y-0.5',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-xs hover:-translate-y-0.5',
  accept: 'bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 shadow-[0_4px_14px_rgba(52,211,153,0.25)] hover:shadow-[0_6px_20px_rgba(52,211,153,0.35)] hover:-translate-y-0.5',
  rejectRed: 'bg-red-500 text-white border-2 border-[#8B5E52] hover:bg-red-600 active:bg-red-700 shadow-[0_4px_14px_rgba(239,68,68,0.25)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.35)] hover:-translate-y-0.5'
};

const sizeStyles = {
  sm: 'px-3.5 py-1.5 text-xs font-semibold',
  md: 'px-5 py-2.5 text-sm font-semibold',
  lg: 'px-6 py-3.5 text-base font-semibold'
};

const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  type = 'button',
  ...props
}) => {
  const selectedVariant = variantStyles[variant] || variantStyles.primary;
  const selectedSize = sizeStyles[size] || sizeStyles.md;

  const classes = `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#BD715C]/30 disabled:cursor-not-allowed disabled:opacity-50 ${selectedVariant} ${selectedSize} ${className}`;

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...props}>
      {loading ? (
        <>
          <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default memo(Button);
