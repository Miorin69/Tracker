import { VISUAL_ASSETS } from '../data/visualAssets';
import type {
  FocusCategory,
  VisualMode,
  WorkoutFocusSummary,
  WorkoutVisualAiBrief,
} from './workoutFocusLogic';

export function getIllustrationAssetForCategory(category: FocusCategory): string {
  switch (category) {
    case 'push':
      return VISUAL_ASSETS.focusPush;
    case 'pull':
      return VISUAL_ASSETS.focusPull;
    case 'legs':
      return VISUAL_ASSETS.focusLegs;
    case 'full-body':
      return VISUAL_ASSETS.focusFullBody;
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  verticalBias = 0.5,
) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) * verticalBias;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else if (lines.length < maxLines - 1) {
      if (current) lines.push(current);
      current = word;
    } else {
      // Final allowed line: keep as much as fits and append ellipsis
      let finalLine = current ? `${current} ${word}` : word;
      while (
        ctx.measureText(`${finalLine}...`).width > maxWidth &&
        finalLine.length > 3
      ) {
        const lastSpace = finalLine.lastIndexOf(' ');
        if (lastSpace > 3) {
          finalLine = finalLine.slice(0, lastSpace);
        } else {
          finalLine = finalLine.slice(0, -1);
        }
      }
      lines.push(`${finalLine.replace(/[.,;:\s]+$/, '')}...`);
      return lines;
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines;
}

export interface RenderInfographicOptions {
  focus: WorkoutFocusSummary;
  mode: VisualMode;
  weekStartDate: string;
  aiBrief?: WorkoutVisualAiBrief | null;
}

/**
 * Generates a high-resolution (1200x800) Training Routine Infographic or
 * Exercise Illustration Poster as a PNG data URL on an HTML5 Canvas.
 */
export async function renderWorkoutInfographicPng({
  focus,
  mode,
  weekStartDate,
  aiBrief,
}: RenderInfographicOptions): Promise<string> {
  const WIDTH = 1200;
  const HEIGHT = 800;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D rendering is not supported in this browser.');
  }

  const assetSrc = getIllustrationAssetForCategory(focus.category);
  const artwork = await loadImage(assetSrc);

  const headline = aiBrief?.headline || focus.focusTitle;
  const formCues =
    aiBrief?.formCues && aiBrief.formCues.length > 0
      ? aiBrief.formCues.slice(0, 3)
      : focus.defaultFormCues.slice(0, 3);
  const muscles =
    aiBrief?.targetMuscles && aiBrief.targetMuscles.length > 0
      ? aiBrief.targetMuscles.slice(0, 4)
      : focus.targetMuscles.slice(0, 4);
  const tempoLine = aiBrief?.intensityNote || focus.tempoNote;

  // Base dark twilight gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bgGrad.addColorStop(0, '#0b0716');
  bgGrad.addColorStop(0.55, '#150e2b');
  bgGrad.addColorStop(1, '#0e0920');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle sunset radial accent top-right
  const glow = ctx.createRadialGradient(WIDTH * 0.85, 40, 20, WIDTH * 0.85, 40, 520);
  glow.addColorStop(0, 'rgba(255, 46, 147, 0.22)');
  glow.addColorStop(0.5, 'rgba(255, 122, 69, 0.10)');
  glow.addColorStop(1, 'rgba(11, 7, 22, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Top Vice horizon bar
  const horizonGrad = ctx.createLinearGradient(0, 0, WIDTH, 0);
  horizonGrad.addColorStop(0, '#ff2e93');
  horizonGrad.addColorStop(0.45, '#ff7a45');
  horizonGrad.addColorStop(0.75, '#ffd166');
  horizonGrad.addColorStop(1, '#22d3ee');
  ctx.fillStyle = horizonGrad;
  ctx.fillRect(0, 0, WIDTH, 8);

  if (mode === 'illustration') {
    // HERO EXERCISE ILLUSTRATION POSTER LAYOUT
    // Full-width framed artwork
    const imgX = 36;
    const imgY = 34;
    const imgW = WIDTH - 72;
    const imgH = 520;

    ctx.save();
    drawRoundedRect(ctx, imgX, imgY, imgW, imgH, 16);
    ctx.clip();
    if (artwork) {
      drawCoverImage(ctx, artwork, imgX, imgY, imgW, imgH, 0.2);
    } else {
      ctx.fillStyle = '#1b1336';
      ctx.fillRect(imgX, imgY, imgW, imgH);
    }

    // Smooth dark lower scrim so overlaid typography is crisp
    const scrim = ctx.createLinearGradient(0, imgY + imgH * 0.35, 0, imgY + imgH);
    scrim.addColorStop(0, 'rgba(11, 7, 22, 0)');
    scrim.addColorStop(0.65, 'rgba(11, 7, 22, 0.72)');
    scrim.addColorStop(1, 'rgba(11, 7, 22, 0.96)');
    ctx.fillStyle = scrim;
    ctx.fillRect(imgX, imgY, imgW, imgH);
    ctx.restore();

    // Frame border
    drawRoundedRect(ctx, imgX, imgY, imgW, imgH, 16);
    ctx.strokeStyle = 'rgba(255, 79, 163, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Category tag top-left inside poster
    drawRoundedRect(ctx, imgX + 22, imgY + 22, 290, 34, 6);
    ctx.fillStyle = 'rgba(11, 7, 22, 0.84)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38e8ff';
    ctx.font = '700 14px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(focus.categoryLabel.toUpperCase(), imgX + 36, imgY + 44);

    // Poster Title & Subtitle inside lower scrim
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.fillText(
      `WEEK OF ${weekStartDate}  ·  ${focus.splitLabel.toUpperCase()}`,
      imgX + 26,
      imgY + imgH - 96,
    );

    ctx.fillStyle = '#faf7ff';
    ctx.font = '800 42px "Barlow Condensed", "Plus Jakarta Sans", system-ui, sans-serif';
    const titleLines = wrapTextLines(ctx, headline.toUpperCase(), imgW - 56, 2);
    titleLines.forEach((line, idx) => {
      ctx.fillText(line, imgX + 26, imgY + imgH - 50 + idx * 42);
    });

    // Bottom 2-column coaching & muscle execution band
    const bandY = 576;
    const bandH = 190;

    // Left box: Primary Muscles + Tempo
    drawRoundedRect(ctx, 36, bandY, 430, bandH, 12);
    ctx.fillStyle = '#150f29';
    ctx.fill();
    ctx.strokeStyle = '#35285b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ff6ea8';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillText('TARGET MUSCLES', 58, bandY + 34);

    let chipX = 58;
    let chipY = bandY + 52;
    ctx.font = '600 14px "Plus Jakarta Sans", system-ui, sans-serif';
    for (const m of muscles) {
      const mWidth = ctx.measureText(m).width + 24;
      if (chipX + mWidth > 448) {
        chipX = 58;
        chipY += 36;
      }
      drawRoundedRect(ctx, chipX, chipY, mWidth, 28, 6);
      ctx.fillStyle = '#241845';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 232, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#f6f2ff';
      ctx.fillText(m, chipX + 12, chipY + 19);
      chipX += mWidth + 8;
    }

    ctx.fillStyle = '#b5a7d6';
    ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
    const tempoLines = wrapTextLines(ctx, tempoLine, 386, 2);
    tempoLines.forEach((line, i) => {
      ctx.fillText(line, 58, bandY + 144 + i * 20);
    });

    // Right box: 3 Biomechanics Form Cues
    drawRoundedRect(ctx, 488, bandY, 676, bandH, 12);
    ctx.fillStyle = '#150f29';
    ctx.fill();
    ctx.strokeStyle = '#35285b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38e8ff';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillText('EXECUTION & FORM CUES', 512, bandY + 34);

    formCues.forEach((cue, idx) => {
      const cy = bandY + 64 + idx * 42;
      ctx.fillStyle = '#ffd166';
      ctx.font = '700 15px "JetBrains Mono", monospace';
      ctx.fillText(`0${idx + 1}.`, 512, cy);

      ctx.fillStyle = '#ede7fc';
      ctx.font = '500 15px "Plus Jakarta Sans", system-ui, sans-serif';
      const cueLines = wrapTextLines(ctx, cue, 594, 2);
      cueLines.forEach((line, lIdx) => {
        ctx.fillText(line, 550, cy + lIdx * 18);
      });
    });

    return canvas.toDataURL('image/png');
  }

  // ROUTINE INFOGRAPHIC LAYOUT (Default)
  // Header Band
  ctx.fillStyle = '#ff6ea8';
  ctx.font = '700 14px "JetBrains Mono", monospace';
  ctx.fillText(
    `WEEKLY TRAINING INFOGRAPHIC  ·  WEEK OF ${weekStartDate}`,
    40,
    48,
  );

  ctx.fillStyle = '#faf7ff';
  ctx.font = '800 40px "Barlow Condensed", "Plus Jakarta Sans", system-ui, sans-serif';
  const headerLines = wrapTextLines(ctx, headline.toUpperCase(), 730, 1);
  ctx.fillText(headerLines[0] || focus.focusTitle.toUpperCase(), 40, 92);

  ctx.fillStyle = '#c5b8e3';
  ctx.font = '500 16px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(focus.focusSubtitle, 40, 120);

  // Top-right KPI boxes (4 compact stat tiles)
  const stats = [
    { label: 'ACTIVE DAYS', value: `${focus.activeDaysCount}/7`, color: '#34d399' },
    { label: 'WEEKLY VOL', value: `${focus.totalWeeklyMinutes}m`, color: '#ffd166' },
    { label: 'CALORIES', value: `${focus.caloriesTarget}`, color: '#ff6ea8' },
    { label: 'PROTEIN', value: `${focus.proteinTarget}g`, color: '#38e8ff' },
  ];

  stats.forEach((stat, i) => {
    const bx = 788 + i * 96;
    const by = 34;
    drawRoundedRect(ctx, bx, by, 88, 86, 10);
    ctx.fillStyle = '#150f29';
    ctx.fill();
    ctx.strokeStyle = '#35285b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#9f8ec7';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText(stat.label, bx + 10, by + 26);

    ctx.fillStyle = stat.color;
    ctx.font = '800 22px "JetBrains Mono", monospace';
    ctx.fillText(stat.value, bx + 10, by + 62);
  });

  // LEFT COLUMN: Representative Exercise Illustration + Target Muscles + Warm-up
  const leftX = 40;
  const leftW = 540;
  const artY = 148;
  const artH = 385;

  ctx.save();
  drawRoundedRect(ctx, leftX, artY, leftW, artH, 14);
  ctx.clip();
  if (artwork) {
    drawCoverImage(ctx, artwork, leftX, artY, leftW, artH);
  } else {
    ctx.fillStyle = '#1b1336';
    ctx.fillRect(leftX, artY, leftW, artH);
  }
  const artFade = ctx.createLinearGradient(0, artY + artH - 120, 0, artY + artH);
  artFade.addColorStop(0, 'rgba(11, 7, 22, 0)');
  artFade.addColorStop(1, 'rgba(11, 7, 22, 0.92)');
  ctx.fillStyle = artFade;
  ctx.fillRect(leftX, artY, leftW, artH);
  ctx.restore();

  drawRoundedRect(ctx, leftX, artY, leftW, artH, 14);
  ctx.strokeStyle = 'rgba(255, 79, 163, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Focus category caption bottom-left of artwork
  ctx.fillStyle = '#38e8ff';
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.fillText(focus.categoryLabel.toUpperCase(), leftX + 20, artY + artH - 42);

  ctx.fillStyle = '#f6f2ff';
  ctx.font = '600 15px "Plus Jakarta Sans", system-ui, sans-serif';
  const subTempo = wrapTextLines(ctx, tempoLine, leftW - 40, 1);
  ctx.fillText(subTempo[0] || focus.tempoNote, leftX + 20, artY + artH - 18);

  // Target Muscles + Warm-up Card under artwork
  const muscleCardY = 552;
  const muscleCardH = 192;
  drawRoundedRect(ctx, leftX, muscleCardY, leftW, muscleCardH, 12);
  ctx.fillStyle = '#150f29';
  ctx.fill();
  ctx.strokeStyle = '#35285b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffd166';
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.fillText('PRIMARY MUSCLES TARGETED', leftX + 20, muscleCardY + 32);

  let mx = leftX + 20;
  let my = muscleCardY + 48;
  ctx.font = '600 14px "Plus Jakarta Sans", system-ui, sans-serif';
  for (const muscle of muscles) {
    const mw = ctx.measureText(muscle).width + 24;
    if (mx + mw > leftX + leftW - 20) {
      mx = leftX + 20;
      my += 36;
    }
    drawRoundedRect(ctx, mx, my, mw, 28, 6);
    ctx.fillStyle = '#241845';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#faf7ff';
    ctx.fillText(muscle, mx + 12, my + 19);
    mx += mw + 8;
  }

  ctx.fillStyle = '#34d399';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText('WARM-UP PROTOCOL', leftX + 20, muscleCardY + 138);

  ctx.fillStyle = '#d4c8ef';
  ctx.font = '500 14px "Plus Jakarta Sans", system-ui, sans-serif';
  const warmupLines = wrapTextLines(ctx, focus.warmupCues, leftW - 40, 2);
  warmupLines.forEach((line, idx) => {
    ctx.fillText(line, leftX + 20, muscleCardY + 160 + idx * 19);
  });

  // RIGHT COLUMN: Routine Breakdown + Form Cues
  const rightX = 604;
  const rightW = 556;

  // Card 1: Key Lifts / Routine Breakdown
  drawRoundedRect(ctx, rightX, 148, rightW, 316, 12);
  ctx.fillStyle = '#150f29';
  ctx.fill();
  ctx.strokeStyle = '#35285b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ff6ea8';
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.fillText(
    focus.scope === 'week'
      ? 'WEEKLY ROUTINE HIGHLIGHTS'
      : `${(focus.dayName || 'SESSION').toUpperCase()} KEY EXERCISES`,
    rightX + 22,
    180,
  );

  focus.keyExercises.slice(0, 6).forEach((exercise, idx) => {
    const rowY = 204 + idx * 41;
    drawRoundedRect(ctx, rightX + 20, rowY, rightW - 40, 33, 7);
    ctx.fillStyle = idx % 2 === 0 ? '#1c1438' : '#120d26';
    ctx.fill();

    ctx.fillStyle = '#38e8ff';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText(`0${idx + 1}`, rightX + 32, rowY + 21);

    ctx.fillStyle = '#faf7ff';
    ctx.font = '600 15px "Plus Jakarta Sans", system-ui, sans-serif';
    const exLines = wrapTextLines(ctx, exercise, rightW - 104, 1);
    ctx.fillText(exLines[0] || exercise, rightX + 64, rowY + 22);
  });

  // Card 2: Form & Execution Cues
  drawRoundedRect(ctx, rightX, 484, rightW, 260, 12);
  ctx.fillStyle = '#150f29';
  ctx.fill();
  ctx.strokeStyle = '#35285b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#38e8ff';
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.fillText('COACHING CUES & EXECUTION', rightX + 22, 516);

  formCues.forEach((cue, idx) => {
    const cy = 548 + idx * 66;
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.fillText(`0${idx + 1}.`, rightX + 22, cy);

    ctx.fillStyle = '#e6ddf8';
    ctx.font = '500 15px "Plus Jakarta Sans", system-ui, sans-serif';
    const lines = wrapTextLines(ctx, cue, rightW - 84, 2);
    lines.forEach((line, lIdx) => {
      ctx.fillText(line, rightX + 58, cy + lIdx * 21);
    });
  });

  // Footer strip
  ctx.fillStyle = '#7f6ea8';
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillText(
    'WEEKLY TRAINING & MEAL PREP COMMAND SHEET  ·  SHAREABLE TRAINING INFOGRAPHIC',
    40,
    776,
  );
  ctx.fillStyle = '#38e8ff';
  ctx.textAlign = 'right';
  const footerGuide =
    wrapTextLines(
      ctx,
      `YOUTUBE GUIDE: ${focus.youtubeSearchQuery.toUpperCase()}`,
      470,
      1,
    )[0] || 'YOUTUBE GUIDE READY';
  ctx.fillText(footerGuide, WIDTH - 40, 776);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}
