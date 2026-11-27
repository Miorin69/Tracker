import { useRef } from 'react';
import type { User } from 'firebase/auth';
import { VISUAL_ASSETS } from '../data/visualAssets';
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileCodeIcon,
  UploadIcon,
} from './Icons';
import { ResilientImage } from './ResilientImage';

interface ActionBarProps {
  copied: boolean;
  importError: string | null;
  welcomeVisible: boolean;
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  syncError: string | null;
  onSignIn: () => void;
  onDismissSyncError: () => void;
  onShowWelcome: () => void;
  onOpenCoach: () => void;
  onCopyMarkdown: () => void;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
  onDownloadHtml: () => void;
  onDismissImportError: () => void;
}

export function ActionBar({
  copied,
  importError,
  welcomeVisible,
  user,
  authReady,
  isSigningIn,
  syncError,
  onSignIn,
  onDismissSyncError,
  onShowWelcome,
  onOpenCoach,
  onCopyMarkdown,
  onExportJson,
  onImportJsonFile,
  onDownloadHtml,
  onDismissImportError,
}: ActionBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportJsonFile(file);
    }
    event.target.value = '';
  };

  return (
    <div className="no-print mb-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#16102b]/95 border border-[#35285b] rounded-lg px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCopyMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#ede7fc] bg-[#21183e] border border-[#3e2f6b] rounded-md hover:bg-[#2c2052] hover:border-[#ff4fa3]/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#22d3ee] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? (
              <CheckIcon className="w-3.5 h-3.5 text-[#34d399]" />
            ) : (
              <CopyIcon className="w-3.5 h-3.5 text-[#ff7a45]" />
            )}
            <span>{copied ? 'Copied!' : 'Copy as Markdown'}</span>
          </button>

          <button
            type="button"
            onClick={onExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#ede7fc] bg-[#21183e] border border-[#3e2f6b] rounded-md hover:bg-[#2c2052] hover:border-[#ff4fa3]/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#22d3ee] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <DownloadIcon className="w-3.5 h-3.5 text-[#22d3ee]" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#ede7fc] bg-[#21183e] border border-[#3e2f6b] rounded-md hover:bg-[#2c2052] hover:border-[#ff4fa3]/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#22d3ee] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UploadIcon className="w-3.5 h-3.5 text-[#ffd166]" />
            <span>Import JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Import JSON plan file"
          />

          <button
            type="button"
            onClick={onDownloadHtml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#ede7fc] bg-[#21183e] border border-[#3e2f6b] rounded-md hover:bg-[#2c2052] hover:border-[#ff4fa3]/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#22d3ee] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileCodeIcon className="w-3.5 h-3.5 text-[#f0abfc]" />
            <span>Export HTML</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!welcomeVisible && (
            <button
              type="button"
              onClick={onShowWelcome}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-[#c5b8e3] bg-[#1a1333] border border-[#35285b] rounded-md hover:bg-[#261b48] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#22d3ee] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Welcome Guide
            </button>
          )}
          <button
            type="button"
            onClick={onOpenCoach}
            className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 text-xs font-semibold text-[#faf7ff] bg-[#241945] border border-[#22d3ee]/50 rounded-md hover:bg-[#22d3ee]/15 hover:border-[#22d3ee] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#22d3ee] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ResilientImage
              src={VISUAL_ASSETS.coachAvatar}
              alt="Coach Hishay"
              fallbackLabel="CH"
              className="w-5 h-5 rounded-full object-cover object-top border border-[#22d3ee]/60 shrink-0"
            />
            <span>Coach Hishay</span>
          </button>
        </div>
      </div>

      {authReady && !user && (
        <div
          data-testid="guest-cloud-save-prompt"
          className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-3.5 py-2 text-xs bg-[#171130]/95 border border-[#38e8ff]/35 rounded-md"
        >
          <p className="text-[#d4c8ef] min-w-0">
            <span className="font-semibold text-[#38e8ff]">
              Personal Cloud Save:
            </span>{' '}
            Sign in with Google to save your plan &amp; progress to your account
            automatically.
          </p>
          <button
            type="button"
            disabled={isSigningIn}
            onClick={onSignIn}
            className="px-3 py-1 text-xs font-semibold text-[#faf7ff] bg-[#231845] border border-[#38e8ff]/60 rounded hover:bg-[#2e2059] hover:border-[#38e8ff] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
      )}

      {syncError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs text-[#fecdd3] bg-[#3b1224] border border-[#fb7185]/50 rounded-md"
        >
          <span>{syncError}</span>
          <button
            type="button"
            onClick={onDismissSyncError}
            className="font-semibold text-white hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {importError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs text-[#fecdd3] bg-[#3b1224] border border-[#fb7185]/50 rounded-md"
        >
          <span>{importError}</span>
          <button
            type="button"
            onClick={onDismissImportError}
            className="font-semibold text-white hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
