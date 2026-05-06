export function calculateReportWindow(hours) {
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - hours * 60 * 60 * 1000);

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString()
  };
}
