export interface ReviewMenuItem {
  title: string;
  onClick: () => void;
}

export function buildReviewMenuItems(params: {
  isReviewActive: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onRestart: () => void;
}): ReviewMenuItem[] {
  const items: ReviewMenuItem[] = [{ title: 'Next unread', onClick: params.onNext }];

  if (params.isReviewActive) {
    items.push({ title: 'Previous in review', onClick: params.onPrevious });
  }

  items.push({ title: 'Restart queue from beginning', onClick: params.onRestart });

  return items;
}
