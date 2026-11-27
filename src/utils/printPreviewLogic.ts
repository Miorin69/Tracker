export type PrintPaperSize = 'letter' | 'a4';

export interface PaperSpec {
  id: PrintPaperSize;
  label: string;
  dimensionsLabel: string;
  widthPx: number;
  pageHeightPx: number;
  marginLabel: string;
}

// 96 DPI CSS pixel equivalents for standard physical paper formats
export const PAPER_SPECS: Record<PrintPaperSize, PaperSpec> = {
  letter: {
    id: 'letter',
    label: 'US Letter',
    dimensionsLabel: '8.5 × 11 in',
    widthPx: 816,
    pageHeightPx: 1056,
    marginLabel: '0.35 in margins',
  },
  a4: {
    id: 'a4',
    label: 'A4',
    dimensionsLabel: '210 × 297 mm',
    widthPx: 794,
    pageHeightPx: 1123,
    marginLabel: '9 mm margins',
  },
};

export interface PageFitSummary {
  estimatedPages: number;
  fitsSinglePage: boolean;
  label: string;
}

export function estimatePrintPageFit(
  contentHeightPx: number,
  paper: PaperSpec,
): PageFitSummary {
  if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) {
    return {
      estimatedPages: 1,
      fitsSinglePage: true,
      label: 'Fits 1 page',
    };
  }
  // Small 16px tolerance accounts for browser subpixel rounding at the page edge
  const tolerancePx = 16;
  const pages = Math.max(
    1,
    Math.ceil((contentHeightPx - tolerancePx) / paper.pageHeightPx),
  );
  return {
    estimatedPages: pages,
    fitsSinglePage: pages === 1,
    label: pages === 1 ? 'Fits 1 page' : `~${pages} pages`,
  };
}
