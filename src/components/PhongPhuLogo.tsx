import React from 'react';

export const PhongPhuLogo = ({ className = "" }: { className?: string }) => (
  <img 
    src="/Logo.jpeg" 
    alt="Phong Phu Home Textile Logo" 
    className={`object-contain ${className}`}
  />
);
