import React from 'react';
import '../styles/Button.css';

const Button = ({ 
  children, 
  variant = 'primary', // primary, secondary, outline, text
  size = 'medium', // small, medium, large
  fullWidth = false,
  className = '',
  as = 'button', // button, link
  href,
  onClick,
  disabled = false,
  ...props 
}) => {
  const Component = as === 'link' ? 'a' : 'button';
  
  const classNames = [
    'custom-button',
    `button-${variant}`,
    `button-${size}`,
    fullWidth ? 'button-full-width' : '',
    className
  ].filter(Boolean).join(' ');

  const componentProps = {
    className: classNames,
    disabled: as === 'button' ? disabled : undefined,
    onClick,
    href: as === 'link' ? href : undefined,
    ...props
  };

  return (
    <Component {...componentProps}>
      {children}
    </Component>
  );
};

export default Button; 