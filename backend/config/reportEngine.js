// backend/config/reportEngine.js
//
// Runtime-switchable report engine: "bip" (real BI Publisher SOAP, i.e.
// BIP Enterprise) or "reportingtool" (the ReportingTool REST shim, i.e.
// BIP Free — see services/reportingToolService.js). Defaults from
// REPORT_ENGINE in .env but can be flipped live via the admin top-bar
// dropdown (PUT /api/admin/report-engine), without restarting the server.

const ENGINES = {
  bip:           () => require('../services/bipSoapService'),
  reportingtool: () => require('../services/reportingToolService'),
};

// USERS.REPORT_SERVER value that each engine's users are tagged with — lets
// the admin UI (Users / Assign Reports / Report Logs) filter its user list
// down to whichever edition is currently selected in the top-bar dropdown.
const ENGINE_TO_SERVER = {
  bip:           'BIP Server',
  reportingtool: 'Profinch Report Server',
};

let currentEngine = ENGINES[process.env.REPORT_ENGINE] ? process.env.REPORT_ENGINE : 'bip';

function getEngine() {
  return currentEngine;
}

function setEngine(name) {
  if (!ENGINES[name]) throw new Error(`Unknown report engine: ${name}`);
  currentEngine = name;
}

function getService() {
  return ENGINES[currentEngine]();
}

function getServerForEngine(name = currentEngine) {
  return ENGINE_TO_SERVER[name];
}

const SERVER_TO_ENGINE = Object.fromEntries(
  Object.entries(ENGINE_TO_SERVER).map(([engine, server]) => [server, engine])
);

// Client-facing requests must use the engine tied to *that user's*
// REPORT_SERVER, not whichever edition the admin currently has the top-bar
// dropdown set to — the dropdown only scopes the admin's own Users /
// Assign Reports / Report Logs views. Falls back to the global current
// engine if a user somehow has no/unknown REPORT_SERVER.
function getServiceForServer(serverLabel) {
  const engine = SERVER_TO_ENGINE[serverLabel] || currentEngine;
  return ENGINES[engine]();
}

module.exports = {
  getEngine, setEngine, getService, getServerForEngine, getServiceForServer,
  ENGINES: Object.keys(ENGINES),
};
