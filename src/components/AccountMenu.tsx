import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';

export type CloudSyncState =
  | 'guest'
  | 'loading'
  | 'saving'
  | 'saved'
  | 'error';

interface AccountMenuProps {
  user: User | null;
  authReady: boolean;
  syncState: CloudSyncState;
  syncError: string | null;
  isSigningIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

function GoogleMarkIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"
      />
      <path
        fill="#34A853"
        d="M3.3 7.5l3.2 2.4C7.4 7.7 9.5 6.2 12 6.2c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2 8.2 2.2 4.9 4.4 3.3 7.5z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.8c2.6 0 4.8-.9 6.4-2.4l-3-2.5c-.8.6-1.9 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1l-3.2 2.5C4.8 19.6 8.1 21.8 12 21.8z"
      />
      <path
        fill="#4285F4"
        d="M21.4 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.3 1.2-1 2.2-2.1 2.9l3 2.5c1.8-1.6 3-4.1 3-7.7z"
      />
    </svg>
  );
}

export function AccountMenu({
  user,
  authReady,
  syncState,
  syncError,
  isSigningIn,
  onSignIn,
  onSignOut,
}: AccountMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  if (!authReady) {
    return (
      <div
        aria-hidden="true"
        className="h-8 sm:h-9 w-24 rounded-md bg-[#1e153a] border border-[#35285b] animate-pulse shrink-0"
      />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        data-testid="google-signin-button"
        disabled={isSigningIn}
        onClick={onSignIn}
        className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 h-8 sm:h-9 text-xs sm:text-sm font-semibold text-[#faf7ff] bg-[#1d1438] border border-[#38e8ff]/50 rounded-md hover:bg-[#2a1d4f] hover:border-[#38e8ff] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22d3ee] transition-all whitespace-nowrap shrink-0 cursor-pointer"
      >
        <GoogleMarkIcon className="w-3.5 h-3.5 shrink-0" />
        <span>{isSigningIn ? 'Signing in...' : 'Sign In'}</span>
      </button>
    );
  }

  const firstName =
    (user.displayName || user.email || 'Account').split(/[\s@]/)[0] || 'Account';
  const initials = firstName.slice(0, 2).toUpperCase();

  const syncLabel =
    syncState === 'saving'
      ? 'Saving...'
      : syncState === 'loading'
        ? 'Loading...'
        : syncState === 'error'
          ? 'Sync issue'
          : 'Saved';

  const syncTextColor =
    syncState === 'error'
      ? 'text-[#fda4af]'
      : syncState === 'saving' || syncState === 'loading'
        ? 'text-[#ffd166]'
        : 'text-[#34d399]';

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        data-testid="account-menu-trigger"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 pl-1.5 pr-2.5 h-8 sm:h-9 text-xs font-semibold text-[#faf7ff] bg-[#1c1436] border border-[#4a397a] rounded-md hover:border-[#38e8ff]/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22d3ee] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User avatar'}
            referrerPolicy="no-referrer"
            className="w-6 h-6 rounded-full object-cover border border-[#38e8ff]/60 shrink-0"
          />
        ) : (
          <span className="w-6 h-6 rounded-full bg-[#332361] border border-[#38e8ff]/60 text-[10px] font-bold text-[#faf7ff] inline-flex items-center justify-center shrink-0">
            {initials}
          </span>
        )}
        <span className="hidden sm:inline max-w-[100px] truncate">
          {firstName}
        </span>
        <span
          className={`hidden xl:inline text-[11px] font-medium ${syncTextColor}`}
        >
          · {syncLabel}
        </span>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-lg bg-[#16102d] border border-[#4a397a] shadow-[0_18px_48px_rgba(5,2,14,0.85)] p-3.5 space-y-3 z-40"
        >
          <div className="space-y-0.5 border-b border-[#2d2150] pb-2.5">
            <div className="text-xs font-bold text-[#faf7ff] truncate">
              {user.displayName || 'Signed-in User'}
            </div>
            <div className="text-[11px] text-[#b5a7d6] truncate">
              {user.email}
            </div>
            <div className={`text-[11px] font-medium pt-1 ${syncTextColor}`}>
              {syncState === 'saving'
                ? 'Saving your latest edits to your account...'
                : syncState === 'loading'
                  ? 'Loading your saved progress...'
                  : syncState === 'error'
                    ? syncError || 'Could not reach cloud save right now.'
                    : 'Progress automatically saved to your account'}
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            data-testid="google-signout-button"
            onClick={() => {
              setMenuOpen(false);
              onSignOut();
            }}
            className="w-full h-8 px-3 text-xs font-semibold text-[#fecdd3] bg-[#361327] border border-[#fb7185]/40 rounded-md hover:bg-[#4c1936] hover:text-white transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
