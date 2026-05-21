export function computeVariancePct(actual, baseline) {
  if (!baseline) {
    return 0;
  }

  return Number((((actual - baseline) / baseline) * 100).toFixed(2));
}

export function computePaybackDays(cashSeries) {
  let cumulative = 0;

  for (let index = 0; index < cashSeries.length; index += 1) {
    cumulative += Number(cashSeries[index] ?? 0);

    if (cumulative >= 0) {
      return index;
    }
  }

  return null;
}

export function computeProjectHealth({
  npv,
  irr,
  targetIrr,
  mirr,
  targetMirr,
  paybackDays,
  targetPaybackDays,
  activeAlerts,
}) {
  const score =
    (npv > 0 ? 0 : 2) +
    (irr >= targetIrr ? 0 : 1) +
    (mirr >= targetMirr ? 0 : 1) +
    (paybackDays !== null && paybackDays <= targetPaybackDays ? 0 : 1) +
    (activeAlerts >= 5 ? 1 : 0);

  if (score >= 4) {
    return "critical";
  }

  if (score >= 2) {
    return "watch";
  }

  return "healthy";
}
