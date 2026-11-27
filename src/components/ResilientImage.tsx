import { useState } from 'react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  fallbackClassName?: string;
  loading?: 'eager' | 'lazy';
}

export function ResilientImage({
  src,
  alt,
  className = '',
  fallbackLabel,
  fallbackClassName = '',
  loading = 'eager',
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-gradient-to-br from-[#2a194d] via-[#1c1238] to-[#110a24] text-[#e6ddf8] select-none ${fallbackClassName || className}`}
      >
        <span className="text-xs font-semibold tracking-wide px-2 text-center">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
