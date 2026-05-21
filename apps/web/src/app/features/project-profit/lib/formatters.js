function formatNumber(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  }).format(numericValue);
}

export function formatCurrencyThb(value) {
  const formatted = formatNumber(value, 0);
  return formatted === null ? "N/A" : `THB ${formatted}`;
}

export function formatPercent(value, maximumFractionDigits = 1) {
  const formatted = formatNumber(value, maximumFractionDigits);
  return formatted === null ? "N/A" : `${formatted}%`;
}

export function formatDays(value) {
  if (value === null || value === undefined) {
    return "N/A";
  }

  const days = Number(value);
  return `${days} day${days === 1 ? "" : "s"}`;
}
