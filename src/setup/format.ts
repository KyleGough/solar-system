export const formatKm = (km: number): string =>
  `${Math.round(km).toLocaleString("en-GB")} km`;

export const formatDistance = (millionKm: number): string => {
  if (millionKm < 1) {
    return `${Math.round(millionKm * 1_000_000).toLocaleString("en-GB")} km`;
  }
  return `${millionKm.toLocaleString("en-GB")} million km`;
};

export const formatPeriod = (days: number): string => {
  const abs = Math.abs(days);
  if (abs >= 365) {
    const years = abs / 365.25;
    const rounded = years >= 10 ? years.toFixed(0) : years.toFixed(1);
    return retrograde(`${rounded} year orbit`, days);
  }
  return retrograde(`${Math.round(abs)} day orbit`, days);
};

export const formatPeriodDuration = (days: number): string => {
  const abs = Math.abs(days);
  if (abs >= 365) {
    const years = abs / 365.25;
    const rounded = years >= 10 ? years.toFixed(0) : years.toFixed(1);
    const unit = Number(rounded) === 1 ? "year" : "years";
    return retrograde(`${rounded} ${unit}`, days);
  }
  const dayCount = Math.round(abs);
  const unit = dayCount === 1 ? "day" : "days";
  return retrograde(`${dayCount} ${unit}`, days);
};

export const formatHours = (hours: number): string => {
  const abs = Math.abs(hours);
  const formatted = Number.isInteger(abs)
    ? abs.toLocaleString("en-GB")
    : abs.toLocaleString("en-GB", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
  return retrograde(`${formatted} hours`, hours);
};

export const formatTilt = (degrees: number): string => `${degrees}°`;

const retrograde = (label: string, value: number): string =>
  value < 0 ? `${label} (retrograde)` : label;
