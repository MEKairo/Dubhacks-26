import React from 'react';

export default function MomentLogo({ large = false }) {
  return <span className={`moment-logo ${large ? 'logo-large' : ''}`} aria-label="moment"><span aria-hidden="true">m<span className="logo-clock"><i /><b /></span>ment</span></span>;
}
