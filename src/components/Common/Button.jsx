import './Button.scss';

export default function Button({ children, variant = 'primary', size = 'md', icon, className = '', ...props }) {
  return (
    <button className={`btn btn--${variant} btn--${size} ${className}`} {...props}>
      {icon && <span className="btn__icon">{icon}</span>}
      {children}
    </button>
  );
}
