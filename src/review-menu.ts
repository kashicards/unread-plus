export interface ReviewMenuItem {
  title: string;
  onClick: () => void;
}

export function buildReviewMenuItems(params: {
  isReviewActive: boolean;
  onPrevious: () => void;
  onRestart: () => void;
}): ReviewMenuItem[] {
  const items: ReviewMenuItem[] = [];

  if (params.isReviewActive) {
    items.push({ title: 'Previous in review', onClick: params.onPrevious });
  }

  items.push({ title: 'Restart queue from beginning', onClick: params.onRestart });

  return items;
}
