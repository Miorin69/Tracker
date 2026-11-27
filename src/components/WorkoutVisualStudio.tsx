import { useEffect, useMemo, useRef, useState } from 'react';
import type { DayIndex, WeeklyPlan } from '../types/plan';
import { fetchJsonWithRetry } from '../utils/apiFetch';
import type { SavedVideoMap } from '../utils/localProfileLogic';
import {
  getIllustrationAssetForCategory,
  renderWorkoutInfographicPng,
} from '../utils/infographicCanvas';
import {
  analyzeWorkoutFocus,
  buildYouTubeSearchUrl,
  getYouTubeThumbnailUrl,
  parseYouTubeUrl,
  type FocusScope,
  type VisualMode,
  type WorkoutVisualAiBrief,
  type YouTubeResource,
} from '../utils/workoutFocusLogic';
import {
  DownloadIcon,
  ExternalLinkIcon,
  ImageIcon,
  PlayIcon,
  TrashIcon,
} from './Icons';
import { ResilientImage } from './ResilientImage';

interface WorkoutVisualStudioProps {
  plan: WeeklyPlan;
  savedVideos: SavedVideoMap;
  visualMode: VisualMode;
  onChangeSavedVideos: (updater: (prev: SavedVideoMap) => SavedVideoMap) => void;
  onChangeVisualMode: (mode: VisualMode) => void;
  onShowToast: (message: string) => void;
}

export function WorkoutVisualStudio({
  plan,
  savedVideos,
  visualMode: mode,
  onChangeSavedVideos,
  onChangeVisualMode,
  onShowToast,
}: WorkoutVisualStudioProps) {
  const [scope, setScope] = useState<FocusScope>('week');
  const [generatedPngUrl, setGeneratedPngUrl] = useState<string | null>(null);
  const [isRenderingCanvas, setIsRenderingCanvas] = useState(false);

  const [aiBriefByKey, setAiBriefByKey] = useState<
    Record<string, WorkoutVisualAiBrief>
  >({});
  const [isFetchingBrief, setIsFetchingBrief] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [customUrlInput, setCustomUrlInput] = useState('');
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [customUrlError, setCustomUrlError] = useState<string | null>(null);

  const renderSeqRef = useRef(0);

  const activeDays = useMemo(
    () => plan.days.filter((day) => !day.isRestDay),
    [plan.days],
  );

  // If currently selected day became a rest day, snap back to weekly focus
  const effectiveScope: FocusScope = useMemo(() => {
    if (scope === 'week') return 'week';
    const exists = activeDays.some((d) => d.dayIndex === scope);
    return exists ? scope : 'week';
  }, [scope, activeDays]);

  const focus = useMemo(
    () => analyzeWorkoutFocus(plan, effectiveScope),
    [plan, effectiveScope],
  );

  const focusKey = useMemo(
    () =>
      [
        effectiveScope,
        focus.category,
        focus.focusTitle.toLowerCase(),
        focus.keyExercises.join('|').toLowerCase(),
      ].join('::'),
    [effectiveScope, focus],
  );

  const customStorageKey = `${effectiveScope}::${focus.category}`;
  const savedCustomVideo = savedVideos[customStorageKey] ?? null;
  const aiBrief = aiBriefByKey[focusKey] ?? null;

  // Render high-resolution PNG infographic / exercise illustration whenever inputs change
  useEffect(() => {
    const seq = ++renderSeqRef.current;
    setIsRenderingCanvas(true);

    renderWorkoutInfographicPng({
      focus,
      mode,
      weekStartDate: plan.weekStartDate,
      aiBrief,
    })
      .then((dataUrl) => {
        if (renderSeqRef.current === seq) {
          setGeneratedPngUrl(dataUrl);
          setIsRenderingCanvas(false);
        }
      })
      .catch(() => {
        if (renderSeqRef.current === seq) {
          setIsRenderingCanvas(false);
        }
      });
  }, [focus, mode, plan.weekStartDate, aiBrief]);

  const handleGenerateBriefAndVisual = async (forceRefresh = false) => {
    setIsFetchingBrief(true);
    setFetchError(null);

    try {
      const response = await fetchJsonWithRetry<{
        brief: WorkoutVisualAiBrief;
      }>('/api/ai/workout-visual-brief', {
        method: 'POST',
        body: JSON.stringify({
          currentPlan: plan,
          scope: effectiveScope,
          forceRefresh,
        }),
        maxRetries: 1,
      });

      if (!response.ok || !response.data?.brief) {
        setFetchError(
          response.error ||
            'Could not load YouTube video guide right now. Please try again.',
        );
        return;
      }

      const nextBrief = response.data.brief;
      setAiBriefByKey((prev) => ({ ...prev, [focusKey]: nextBrief }));
      onShowToast(
        nextBrief.videos.length > 0
          ? `Updated visual & found ${nextBrief.videos.length} YouTube guide${nextBrief.videos.length > 1 ? 's' : ''}`
          : 'Updated visual infographic & coaching cues',
      );
    } finally {
      setIsFetchingBrief(false);
    }
  };

  const handleDownloadPng = () => {
    if (!generatedPngUrl) return;
    const slug = focus.category;
    const prefix =
      mode === 'infographic' ? 'routine-infographic' : 'exercise-illustration';
    const link = document.createElement('a');
    link.href = generatedPngUrl;
    link.download = `${prefix}-${slug}-${plan.weekStartDate}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Downloaded high-res PNG poster');
  };

  const handleSaveCustomYouTubeUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseYouTubeUrl(customUrlInput);
    if (!parsed.ok) {
      setCustomUrlError(parsed.error);
      return;
    }

    setCustomUrlError(null);
    const label = customLabelInput.trim() || `${focus.focusTitle} — Saved Video`;
    onChangeSavedVideos((prev) => ({
      ...prev,
      [customStorageKey]: {
        url: parsed.url,
        videoId: parsed.videoId,
        label,
      },
    }));
    setCustomUrlInput('');
    setCustomLabelInput('');
    onShowToast('Saved YouTube link for this training focus');
  };

  const handleRemoveCustomYouTubeUrl = () => {
    onChangeSavedVideos((prev) => {
      const next = { ...prev };
      delete next[customStorageKey];
      return next;
    });
    onShowToast('Removed saved YouTube link');
  };

  const fallbackArtwork = getIllustrationAssetForCategory(focus.category);
  const displayHeadline = aiBrief?.headline || focus.focusTitle;
  const displayCues =
    aiBrief?.formCues && aiBrief.formCues.length > 0
      ? aiBrief.formCues
      : focus.defaultFormCues;
  const displayMuscles =
    aiBrief?.targetMuscles && aiBrief.targetMuscles.length > 0
      ? aiBrief.targetMuscles
      : focus.targetMuscles;
  const activeSearchQuery = aiBrief?.searchQuery || focus.youtubeSearchQuery;
  const activeSearchUrl = buildYouTubeSearchUrl(activeSearchQuery);

  const displayVideos: YouTubeResource[] = useMemo(() => {
    const list: YouTubeResource[] = [];
    if (savedCustomVideo) {
      list.push({
        title: savedCustomVideo.label,
        url: savedCustomVideo.url,
        videoId: savedCustomVideo.videoId,
        channel: 'Saved Custom Link',
        source: 'custom',
      });
    }
    if (aiBrief?.videos) {
      for (const v of aiBrief.videos) {
        if (
          !list.some(
            (existing) => (existing.videoId ?? existing.url) === (v.videoId ?? v.url),
          )
        ) {
          list.push(v);
        }
      }
    }
    return list;
  }, [savedCustomVideo, aiBrief]);

  return (
    <section
      id="section-workout-visual"
      aria-label="Workout Focus Visual Generator and YouTube Video Guide"
      className="no-print max-w-[1440px] mx-auto px-4 sm:px-6 pb-8"
    >
      <div className="bg-[#150f29]/95 border border-[#35285b] rounded-lg overflow-hidden shadow-[0_14px_40px_rgba(7,3,18,0.55)]">
        <div className="h-[3px] w-full vice-horizon-line" aria-hidden="true" />

        <div className="p-5 sm:p-6 space-y-5">
          {/* Top Header Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#38e8ff]">
                <span>Primary Focus Visual Studio</span>
                <span aria-hidden="true" className="text-[#5b478a]">
                  ·
                </span>
                <span className="text-[#ffd166]">{focus.categoryLabel}</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-[#faf7ff] leading-none">
                Routine Infographic &amp; Exercise Illustration
              </h2>
              <p className="text-xs text-[#b5a7d6]">
                Auto-matched to your active weekly plan ({focus.focusSubtitle}).
                Switch views, generate live coaching callouts &amp; YouTube video
                links, or download as PNG.
              </p>
            </div>

            {/* Mode Switch + Actions */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div
                role="group"
                aria-label="Visual layout mode"
                className="inline-flex p-0.5 bg-[#110c23] border border-[#35285b] rounded-md"
              >
                <button
                  type="button"
                  aria-pressed={mode === 'infographic'}
                  onClick={() => onChangeVisualMode('infographic')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer whitespace-nowrap ${
                    mode === 'infographic'
                      ? 'vice-sunset-btn'
                      : 'text-[#c5b8e3] hover:text-[#faf7ff]'
                  }`}
                >
                  Routine Infographic
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'illustration'}
                  onClick={() => onChangeVisualMode('illustration')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer whitespace-nowrap ${
                    mode === 'illustration'
                      ? 'vice-sunset-btn'
                      : 'text-[#c5b8e3] hover:text-[#faf7ff]'
                  }`}
                >
                  Exercise Illustration
                </button>
              </div>

              <button
                type="button"
                disabled={isFetchingBrief}
                onClick={() => handleGenerateBriefAndVisual(Boolean(aiBrief))}
                className="inline-flex items-center gap-1.5 px-3.5 h-9 text-xs font-bold rounded-md vice-sunset-btn disabled:opacity-60 transition-all whitespace-nowrap cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isFetchingBrief
                    ? 'Generating Guide...'
                    : aiBrief
                      ? 'Refresh AI Guide & Video'
                      : 'Generate Visual & YouTube Guide'}
                </span>
              </button>

              <button
                type="button"
                disabled={!generatedPngUrl || isRenderingCanvas}
                onClick={handleDownloadPng}
                className="inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold text-[#ede7fc] bg-[#21183e] border border-[#3e2f6b] rounded-md hover:bg-[#2c2052] hover:border-[#38e8ff]/60 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <DownloadIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Download PNG</span>
              </button>
            </div>
          </div>

          {/* Focus Selector Strip (Weekly Primary Focus or Specific Training Day) */}
          <div
            role="group"
            aria-label="Select workout focus to visualize"
            className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#2d2150]"
          >
            <button
              type="button"
              aria-pressed={effectiveScope === 'week'}
              onClick={() => {
                setScope('week');
                setFetchError(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                effectiveScope === 'week'
                  ? 'bg-[#2c2052] text-[#ffd166] border-[#ffd166]/65'
                  : 'bg-[#110c23] text-[#c5b8e3] border-[#35285b] hover:bg-[#1e153a] hover:text-[#faf7ff]'
              }`}
            >
              Weekly Primary Focus
            </button>
            {activeDays.map((day) => {
              const active = effectiveScope === day.dayIndex;
              const shortLabel =
                day.workoutTitle.split(/\s*[—–]\s*/)[0]?.trim() ||
                day.workoutTitle;
              return (
                <button
                  key={day.dayIndex}
                  type="button"
                  aria-pressed={active}
                  title={`${day.dayName}: ${day.workoutTitle}`}
                  onClick={() => {
                    setScope(day.dayIndex as DayIndex);
                    setFetchError(null);
                  }}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#2c2052] text-[#38e8ff] border-[#38e8ff]/65'
                      : 'bg-[#110c23] text-[#c5b8e3] border-[#35285b] hover:bg-[#1e153a] hover:text-[#faf7ff]'
                  }`}
                >
                  {day.shortName} · {shortLabel}
                </button>
              );
            })}
          </div>

          {/* Error Banner if AI Video/Brief Request Failed */}
          {fetchError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-[#3b1224] border border-[#881337] flex flex-wrap items-center justify-between gap-3 text-xs text-[#fda4af]"
            >
              <span>{fetchError}</span>
              <button
                type="button"
                onClick={() => handleGenerateBriefAndVisual(true)}
                className="px-2.5 py-1 font-semibold text-[#faf7ff] bg-[#5b1735] border border-[#be123c] rounded hover:bg-[#701c41] transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Main 2-Column Content: Generated Infographic / Illustration Canvas + YouTube & Form Guide */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-6 items-start">
            {/* LEFT: Live Generated PNG Infographic / Exercise Illustration */}
            <div className="space-y-3">
              <div
                data-testid="workout-visual-stage"
                className="relative aspect-[3/2] w-full rounded-lg overflow-hidden border border-[#4a397a] bg-[#0b0716] shadow-[0_12px_32px_rgba(0,0,0,0.65)]"
              >
                {generatedPngUrl ? (
                  <img
                    src={generatedPngUrl}
                    alt={`${displayHeadline} — ${mode === 'infographic' ? 'training routine infographic' : 'exercise illustration poster'}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain bg-[#0b0716]"
                  />
                ) : (
                  <ResilientImage
                    src={fallbackArtwork}
                    alt={`${focus.focusTitle} exercise illustration`}
                    fallbackLabel={focus.focusTitle}
                    className="w-full h-full object-cover"
                  />
                )}

                {(isRenderingCanvas || isFetchingBrief) && (
                  <div className="absolute inset-0 bg-[#0b0716]/70 backdrop-blur-[2px] flex items-center justify-center">
                    <div className="px-4 py-2.5 rounded-md bg-[#1b1338] border border-[#ff4fa3]/60 text-xs font-semibold text-[#faf7ff]">
                      {isFetchingBrief
                        ? 'Finding YouTube guides & updating infographic...'
                        : 'Rendering high-res visual...'}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#9f8ec7]">
                <span>
                  Format: 1200×800 PNG ·{' '}
                  {mode === 'infographic'
                    ? 'Full Weekly Routine Infographic'
                    : 'Hero Exercise Form Poster'}
                </span>
                <span className="font-mono text-[#c5b8e3]">
                  Focus: {displayHeadline}
                </span>
              </div>
            </div>

            {/* RIGHT: YouTube Video Direct Links + Custom URL + Target Muscles */}
            <div className="space-y-4">
              {/* YouTube Training Video Card */}
              <div
                data-testid="youtube-guide-panel"
                className="p-4 rounded-lg bg-[#110c23] border border-[#35285b] space-y-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#faf7ff] flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-5 rounded bg-[#ff2e55] text-white shrink-0">
                        <PlayIcon className="w-3 h-3" />
                      </span>
                      <span>YouTube Training Guide</span>
                    </h3>
                    <p className="text-xs text-[#b5a7d6] mt-1">
                      Watch form breakdowns and coaching walkthroughs directly
                      on YouTube for <span className="text-[#faf7ff] font-medium">{focus.focusTitle}</span>.
                    </p>
                  </div>
                </div>

                {/* Verified AI-Grounded or Saved Custom YouTube Videos */}
                {displayVideos.length > 0 && (
                  <ul className="space-y-2.5">
                    {displayVideos.map((video) => (
                      <li
                        key={video.url}
                        className="p-2.5 rounded-md bg-[#181131] border border-[#35285b] flex items-center gap-3"
                      >
                        {video.videoId ? (
                          <div className="w-24 aspect-video rounded overflow-hidden border border-[#35285b] bg-[#0b0716] shrink-0">
                            <ResilientImage
                              src={getYouTubeThumbnailUrl(video.videoId)}
                              alt={video.title}
                              fallbackLabel="YouTube"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded bg-[#261847] border border-[#35285b] flex items-center justify-center text-[#ff4fa3] shrink-0">
                            <PlayIcon className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-xs font-semibold text-[#faf7ff] leading-snug line-clamp-2">
                            {video.title}
                          </div>
                          <div className="text-[11px] text-[#9f8ec7] truncate">
                            {video.channel || 'YouTube Tutorial'}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <a
                              href={video.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#38e8ff] hover:text-[#7df3ff] hover:underline underline-offset-2"
                            >
                              <span>Watch on YouTube</span>
                              <ExternalLinkIcon className="w-3 h-3" />
                            </a>
                            {video.source === 'custom' && (
                              <button
                                type="button"
                                onClick={handleRemoveCustomYouTubeUrl}
                                aria-label="Remove saved custom YouTube link"
                                className="inline-flex items-center gap-1 text-[11px] text-[#fda4af] hover:text-white cursor-pointer"
                              >
                                <TrashIcon className="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Direct YouTube Search / Launch CTA (always available & accurate) */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    data-testid="direct-youtube-link"
                    href={activeSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 h-9 text-xs font-bold text-[#faf7ff] bg-[#d91e41] hover:bg-[#ef284e] rounded-md transition-colors whitespace-nowrap"
                  >
                    <PlayIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>Open Training on YouTube</span>
                    <ExternalLinkIcon className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  {!aiBrief && (
                    <button
                      type="button"
                      disabled={isFetchingBrief}
                      onClick={() => handleGenerateBriefAndVisual(false)}
                      className="px-3 h-9 text-xs font-semibold text-[#ffd166] bg-[#1f163c] border border-[#ffd166]/45 rounded-md hover:bg-[#2a1e4f] disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {isFetchingBrief ? 'Searching...' : 'Find Specific Video'}
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-[#9f8ec7] font-mono truncate">
                  Query: &ldquo;{activeSearchQuery}&rdquo;
                </div>

                {/* Pin Custom YouTube URL Form */}
                <form
                  onSubmit={handleSaveCustomYouTubeUrl}
                  className="pt-3 border-t border-[#2d2150] space-y-2"
                >
                  <label
                    htmlFor="custom-youtube-url"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-[#c5b8e3]"
                  >
                    Pin Your Own YouTube URL for This Focus
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      id="custom-youtube-url"
                      type="url"
                      value={customUrlInput}
                      onChange={(e) => {
                        setCustomUrlInput(e.target.value);
                        if (customUrlError) setCustomUrlError(null);
                      }}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full h-8 px-2.5 text-xs text-[#faf7ff] bg-[#181131] border border-[#3e2f6b] rounded-md placeholder:text-[#78689e] focus:outline-none focus:border-[#ff4fa3] focus:ring-1 focus:ring-[#ff4fa3]"
                    />
                    <div className="flex gap-1.5">
                      <input
                        id="custom-youtube-label"
                        type="text"
                        aria-label="Optional custom video title"
                        value={customLabelInput}
                        onChange={(e) => setCustomLabelInput(e.target.value)}
                        placeholder="Title (optional)"
                        className="flex-1 min-w-0 h-8 px-2.5 text-xs text-[#faf7ff] bg-[#181131] border border-[#3e2f6b] rounded-md placeholder:text-[#78689e] focus:outline-none focus:border-[#38e8ff] focus:ring-1 focus:ring-[#38e8ff]"
                      />
                      <button
                        type="submit"
                        className="px-3 h-8 text-xs font-semibold text-[#faf7ff] bg-[#2a1e4f] border border-[#4a397a] rounded-md hover:border-[#38e8ff]/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Save Link
                      </button>
                    </div>
                  </div>
                  {customUrlError && (
                    <p role="alert" className="text-[11px] text-[#fda4af]">
                      {customUrlError}
                    </p>
                  )}
                </form>
              </div>

              {/* Focus Muscles & Execution Cues Summary */}
              <div className="p-4 rounded-lg bg-[#110c23] border border-[#35285b] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#ffd166]">
                    Target Muscles &amp; Key Form Cues
                  </h3>
                  <span className="text-[11px] font-mono text-[#38e8ff]">
                    {displayMuscles.length} Muscle Groups
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {displayMuscles.map((muscle) => (
                    <span
                      key={muscle}
                      className="px-2 py-0.5 text-[11px] font-medium text-[#ede7fc] bg-[#1e153a] border border-[#3e2f6b] rounded"
                    >
                      {muscle}
                    </span>
                  ))}
                </div>

                <ol className="space-y-1.5 pt-1 border-t border-[#2d2150]">
                  {displayCues.map((cue, index) => (
                    <li
                      key={cue}
                      className="text-xs text-[#d4c8ef] leading-relaxed flex gap-2"
                    >
                      <span className="font-mono font-bold text-[#ff6ea8] shrink-0">
                        0{index + 1}.
                      </span>
                      <span>{cue}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
