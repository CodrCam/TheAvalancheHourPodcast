// components/ParallaxSection.js

import React from 'react';
import { Parallax } from 'react-parallax';

export default function ParallaxSection({
  backgroundImage,
  strength = 300,
  height = '100vh',
  overlayColor = 'rgba(0, 0, 0, 0.2)',
  children,
  bgImageStyle = {},
  bgImageAlt = '',
}) {
  return (
    <Parallax
      bgImage={backgroundImage}
      strength={strength}
      bgImageStyle={{ objectFit: 'cover', ...bgImageStyle }}
      bgImageAlt={bgImageAlt}
    >
      <div style={{ height, position: 'relative' }}>
        {/* Overlay */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundColor: overlayColor,
          }}
        />
        {/* Content */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </div>
      </div>
    </Parallax>
  );
}