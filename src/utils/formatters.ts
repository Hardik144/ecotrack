import { APP_CONFIG } from '@/constants';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function formatCarbonKg(
  valueKg: number,
  options?: { showSign?: boolean; decimals?: number; includeUnit?: boolean }
): string {
  const abs = Math.abs(valueKg);
  const decimals = options?.decimals ?? (abs > 0 && abs < 0.05 ? 3 : 2);
  const includeUnit = options?.includeUnit ?? true;
  const formattedNumber = abs.toFixed(decimals);
  const sign =
    valueKg < 0 ? '-' : options?.showSign && valueKg > 0 ? '+' : '';

  return includeUnit
    ? `${sign}${formattedNumber} ${APP_CONFIG.emissionUnit}`
    : `${sign}${formattedNumber}`;
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatShortDate(isoDate: string): string {
  const dateOnlyMatch = DATE_ONLY_REGEX.exec(isoDate.trim());
  const parsed = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
        12,
        0,
        0
      )
    : new Date(isoDate);

  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
