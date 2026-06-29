const deployedDate = new Intl.DateTimeFormat("zh-HK", {
  timeZone: "Asia/Hong_Kong",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(__DEPLOYED_AT__));

export function AppVersionFooter() {
  return (
    <div className="app-version-footer" aria-label="App version and deployment date">
      <span>Version {__APP_VERSION__}</span>
      <span aria-hidden="true">·</span>
      <span>Deployed {deployedDate} HKT</span>
    </div>
  );
}
