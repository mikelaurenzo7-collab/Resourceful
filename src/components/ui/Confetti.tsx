'use client';

import { useEffect, useState } from 'react';

const COLORS = [
  '#d4a847', // gold
  '#e8c564', // gold-light
  '#b08d2f', // gold-dark
  '#4ade80', // emerald
  '#60a5fa', // blue
  '#f5f0e8', // cream
];

interface ConfettiPiece {
  id: number;
  left: number;
  color: string;
  size: number;
  duration: number;
  delay: number;
  shape: 'square' | 'circle';
}

export default function Confetti({ count = 40 }: { count?: number }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const generated: ConfettiPiece[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 8 + 5,
      duration: Math.random() * 2 + 2.5,
      delay: Math.random() * 1.5,
      shape: Math.random() > 0.5 ? 'square' : 'circle',
    }));
    setPieces(generated);

    // Auto-cleanup after animations finish
    const timer = setTimeout(() => setPieces([]), 5000);
    return () => clearTimeout(timer);
  }, [count]);

  if (pieces.length === 0) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            ['--duration' as string]: `${p.duration}s`,
            ['--delay' as string]: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
