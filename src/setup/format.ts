export const formatKm = (km: number): string =>
  `${Math.round(km).toLocaleString("en-GB")} km`;

type ScientificMass = {
  mantissa: string;
  exponent: number;
};

export const formatMass = (kg: number): ScientificMass => {
  let exponent = Math.floor(Math.log10(kg));
  let coefficient = kg / 10 ** exponent;
  const rounded = Number(coefficient.toFixed(2));
  if (rounded >= 10) {
    coefficient = 1;
    exponent += 1;
  } else {
    coefficient = rounded;
  }

  const mantissa = coefficient.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return { mantissa, exponent };
};

export const formatDistance = (millionKm: number): string => {
  if (millionKm < 1) {
    return `${Math.round(millionKm * 1_000_000).toLocaleString("en-GB")} km`;
  }
  return `${millionKm.toLocaleString("en-GB")} million km`;
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
  if (abs > 240) {
    const days = Math.round(abs / 24);
    const unit = days === 1 ? "day" : "days";
    return retrograde(`${days} ${unit}`, hours);
  }
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
