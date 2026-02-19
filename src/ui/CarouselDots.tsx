import React from 'react';
import { theme } from './theme';

interface CarouselDotsProps {
  total: number;
  current: number;
  onDotClick?: (index: number) => void;
}

export const CarouselDots: React.FC<CarouselDotsProps> = ({ 
  total, 
  current, 
  onDotClick 
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      gap: '8px',
      marginTop: '16px'
    }}>
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          onClick={(e) => {
            e.stopPropagation();
            onDotClick?.(index);
          }}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            border: 'none',
            background: index === current 
              ? theme.colors.dark.accentPurple 
              : 'rgba(255,255,255,0.3)',
            cursor: onDotClick ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
            touchAction: 'manipulation',
          }}
          className="hover:opacity-80"
        />
      ))}
    </div>
  );
};
