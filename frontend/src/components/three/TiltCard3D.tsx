import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionPreference } from './webglUtils';

interface TiltCard3DProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
  glowColor?: string;
}

export const TiltCard3D: React.FC<TiltCard3DProps> = ({
  children,
  className = '',
  intensity = 8,
  glowColor = 'rgba(56, 189, 248, 0.16)',
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotionPreference();
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, hovered: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -intensity;
    const rotateY = ((x - centerX) / centerX) * intensity;
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setTilt({ rotateX, rotateY, glareX, glareY, hovered: true });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, hovered: false });
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      animate={{
        rotateX: reducedMotion ? 0 : tilt.rotateX,
        rotateY: reducedMotion ? 0 : tilt.rotateY,
        y: !reducedMotion && tilt.hovered ? -3 : 0,
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, mass: 0.6 }}
      className={`relative overflow-hidden transition-shadow duration-300 ${
        tilt.hovered
          ? 'shadow-xl shadow-cyan-500/10 dark:shadow-indigo-500/20 border-cyan-400/50 dark:border-indigo-400/50'
          : ''
      } ${className}`}
    >
      {/* Dynamic pointer-responsive radial light accent */}
      {!reducedMotion && tilt.hovered && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(360px circle at ${tilt.glareX}% ${tilt.glareY}%, ${glowColor}, rgba(139, 92, 246, 0.06) 50%, transparent 80%)`,
          }}
        />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
};
