import type { HTMLAttributes } from 'react';
import './WaveDivider.css';

interface WaveDividerProps extends HTMLAttributes<HTMLDivElement> {
  flip?: boolean;
  color?: 'pearl' | 'tint' | 'lavender';
}

export function WaveDivider({ flip = false, color = 'tint', className = '', ...rest }: WaveDividerProps) {
  const gradientId = `wave-grad-${color}${flip ? '-flip' : ''}`;

  return (
    <div
      className={`wave-divider wave-divider--${color} ${flip ? 'wave-divider--flip' : ''} ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <svg
        className="wave-svg"
        viewBox="0 0 1440 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          {/* گرادیانت لایه موج عقب */}
          <linearGradient id={`${gradientId}-back`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4338ca" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.5" />
          </linearGradient>

          {/* گرادیانت لایه موج میانی با رنگ‌های غنی‌تر */}
          <linearGradient id={`${gradientId}-mid`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.75" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.75" />
          </linearGradient>

          {/* گرادیانت لایه موج جلو با رنگ بولد پالت سایت */}
          <linearGradient id={`${gradientId}-front`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.92" />
            <stop offset="45%" stopColor="#a5b4fc" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#c7d2fe" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* لایه سوم موج سینوسی عقب: قله‌ها و دره‌های بلند */}
        <path
          className="wave-path wave-path--back"
          fill={`url(#${gradientId}-back)`}
          d="M0,90 C100,90 100,45 200,45 C290,45 290,140 380,140 C470,140 470,40 560,40 C650,40 650,135 740,135 C830,135 830,48 920,48 C1010,48 1010,145 1100,145 C1190,145 1190,42 1280,42 C1360,42 1360,100 1440,100 L1440,180 L0,180 Z"
        />

        {/* لایه دوم موج سینوسی میانی با فاز معکوس و برجسته */}
        <path
          className="wave-path wave-path--mid"
          fill={`url(#${gradientId}-mid)`}
          d="M0,105 C60,105 60,35 120,35 C210,35 210,130 300,130 C390,130 390,28 480,28 C570,28 570,125 660,125 C750,125 750,38 840,38 C930,38 930,135 1020,135 C1110,135 1110,30 1200,30 C1290,30 1290,110 1380,110 C1410,110 1410,80 1440,80 L1440,180 L0,180 Z"
        />

        {/* لایه اول موج سینوسی اصلی جلو با ۴ قله سینوسی بلند */}
        <path
          className="wave-path wave-path--front"
          fill={`url(#${gradientId}-front)`}
          d="M0,70 C80,70 80,20 160,20 C250,20 250,120 340,120 C430,120 430,15 520,15 C610,15 610,115 700,115 C790,115 790,25 880,25 C970,25 970,125 1060,125 C1150,125 1150,18 1240,18 C1340,18 1340,75 1440,75 L1440,180 L0,180 Z"
        />
      </svg>
    </div>
  );
}
