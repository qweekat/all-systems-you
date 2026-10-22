/* How the phone add-on talks to this app: water in lg.waterOz and lg.waterTaps, the check-in item "checkin", backups through dl. */
const PHX = {
  welcome: false, feelId: "checkin",
  firstSize(){ return waterSizes()[0]; },
  addWater(lg, n){ lg.waterOz = waterOz(lg)+n; lg.waterTaps = [...(lg.waterTaps||[]), n]; },
  waterText(lg){ const g = waterGoalNow(); return waterOz(lg)+(g?" of "+g:"")+" oz today"; },
  waterHtml(lg){ return waterPanel(lg, waterGoalNow()); },
  restoreAttr: 'id="bkFile"', backupAttr: 'id="bkDownload"',
  isRestore(t){ return t.id==="bkFile"; },
  wrapSave(){ dl = phoneSave(dl); }
};
