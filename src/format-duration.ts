const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'now';

  if (ms >= DAY) {
    const days = Math.floor(ms / DAY);
    const hours = Math.floor((ms % DAY) / HOUR);
    return `${days}d ${hours}h`;
  }

  if (ms >= HOUR) {
    const hours = Math.floor(ms / HOUR);
    const minutes = Math.floor((ms % HOUR) / MINUTE);
    return `${hours}h ${minutes}m`;
  }

  const minutes = Math.max(1, Math.floor(ms / MINUTE));
  return `${minutes}m`;
}
