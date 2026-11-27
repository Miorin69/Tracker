import { useEffect, useRef, useState } from 'react';
import {
  getProfileInitials,
  MAX_PROFILE_NAME_LENGTH,
  type LocalProfile,
} from '../utils/localProfileLogic';
import { CheckIcon, PlusIcon, TrashIcon } from './Icons';

interface ProfileMenuProps {
  profiles: LocalProfile[];
  activeProfile: LocalProfile;
  onSelectProfile: (id: string) => void;
  onAddProfile: (name: string) => { ok: boolean; error?: string };
  onRenameProfile: (id: string, name: string) => { ok: boolean; error?: string };
  onDeleteProfile: (id: string) => { ok: boolean; error?: string };
}

export function ProfileMenu({
  profiles,
  activeProfile,
  onSelectProfile,
  onAddProfile,
  onRenameProfile,
  onDeleteProfile,
}: ProfileMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
        setEditingId(null);
        setFormError(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setEditingId(null);
        setFormError(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const res = onAddProfile(newName);
    if (!res.ok) {
      setFormError(res.error ?? 'Could not add profile.');
      return;
    }
    setNewName('');
    setFormError(null);
    setMenuOpen(false);
  };

  const handleRenameSubmit = (event: React.FormEvent, id: string) => {
    event.preventDefault();
    const res = onRenameProfile(id, editingName);
    if (!res.ok) {
      setFormError(res.error ?? 'Could not rename profile.');
      return;
    }
    setEditingId(null);
    setEditingName('');
    setFormError(null);
  };

  const handleDelete = (id: string) => {
    const res = onDeleteProfile(id);
    if (!res.ok) {
      setFormError(res.error ?? 'Could not delete profile.');
      return;
    }
    setFormError(null);
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-label={`Switch local profile (active: ${activeProfile.name})`}
        onClick={() => {
          setMenuOpen((prev) => !prev);
          setFormError(null);
        }}
        className="inline-flex items-center gap-2 pl-1.5 pr-2.5 h-8 sm:h-9 rounded-md bg-[#1a1333] border border-[#3e2f6b] hover:border-[#38e8ff]/70 hover:bg-[#221942] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#ff2e93] to-[#22d3ee] text-[#0c081a] text-[10px] font-extrabold flex items-center justify-center shrink-0">
          {getProfileInitials(activeProfile.name)}
        </span>
        <span className="text-xs font-semibold text-[#faf7ff] max-w-[110px] truncate">
          {activeProfile.name}
        </span>
      </button>

      {menuOpen && (
        <div
          role="dialog"
          aria-label="Local profiles"
          className="absolute right-0 mt-2 w-72 sm:w-80 bg-[#150f29] border border-[#4a397a] rounded-lg shadow-[0_18px_45px_rgba(4,2,14,0.85)] p-3.5 space-y-3 z-40"
        >
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#ffd166]">
                Local Profiles
              </h3>
              <span className="text-[11px] font-mono text-[#38e8ff]">
                Saved on device
              </span>
            </div>
            <p className="text-[11px] text-[#b5a7d6] leading-snug">
              Each person keeps their own plan, daily intake, presets, and BMI
              automatically in this browser.
            </p>
          </div>

          <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
            {profiles.map((profile) => {
              const isActive = profile.id === activeProfile.id;
              const isEditing = editingId === profile.id;

              return (
                <li
                  key={profile.id}
                  className={`rounded-md border px-2.5 py-2 transition-colors ${
                    isActive
                      ? 'bg-[#21183e] border-[#38e8ff]/60'
                      : 'bg-[#110c23] border-[#2d2150] hover:border-[#4a397a]'
                  }`}
                >
                  {isEditing ? (
                    <form
                      onSubmit={(e) => handleRenameSubmit(e, profile.id)}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        aria-label="Edit profile name"
                        maxLength={MAX_PROFILE_NAME_LENGTH}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        className="flex-1 min-w-0 h-7 px-2 text-xs text-[#faf7ff] bg-[#150f29] border border-[#38e8ff] rounded focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-2 h-7 text-[11px] font-semibold text-[#0c081a] bg-[#38e8ff] rounded hover:bg-[#6ef0ff] cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setFormError(null);
                        }}
                        className="px-1.5 h-7 text-[11px] text-[#c5b8e3] hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProfile(profile.id);
                          setMenuOpen(false);
                        }}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <span className="w-6 h-6 rounded-full bg-[#2c2052] border border-[#4a397a] text-[10px] font-bold text-[#faf7ff] flex items-center justify-center shrink-0">
                          {getProfileInitials(profile.name)}
                        </span>
                        <span className="text-xs font-semibold text-[#faf7ff] truncate">
                          {profile.name}
                        </span>
                        {isActive && (
                          <CheckIcon className="w-3.5 h-3.5 text-[#34d399] shrink-0" />
                        )}
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(profile.id);
                            setEditingName(profile.name);
                            setFormError(null);
                          }}
                          aria-label={`Rename profile ${profile.name}`}
                          className="px-1.5 py-0.5 text-[11px] text-[#b5a7d6] hover:text-[#38e8ff] rounded cursor-pointer"
                        >
                          Rename
                        </button>
                        {profiles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDelete(profile.id)}
                            aria-label={`Delete profile ${profile.name}`}
                            className="p-1 text-[#b5a7d6] hover:text-[#fb7185] rounded cursor-pointer"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <form
            onSubmit={handleCreateSubmit}
            className="pt-2.5 border-t border-[#2d2150] space-y-2"
          >
            <label
              htmlFor="new-local-profile-name"
              className="block text-[11px] font-semibold uppercase tracking-wider text-[#c5b8e3]"
            >
              Add Person
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="new-local-profile-name"
                type="text"
                maxLength={MAX_PROFILE_NAME_LENGTH}
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="e.g. Aakrisht, Sam..."
                className="flex-1 min-w-0 h-8 px-2.5 text-xs text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md placeholder:text-[#78689e] focus:outline-none focus:border-[#ff4fa3]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-2.5 h-8 text-xs font-bold rounded-md vice-sunset-btn shrink-0 cursor-pointer"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
            {formError && (
              <p role="alert" className="text-[11px] text-[#fda4af]">
                {formError}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
