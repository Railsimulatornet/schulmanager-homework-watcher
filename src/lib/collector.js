const path = require('path');
const { normalizeItem } = require('./homework');
const { readJson, writeJson, writeText, ensureDir } = require('./files');

function createTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Timeout nach ${timeoutMs} ms`)), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}

async function fetchJson(url, options = {}, timeoutMs = 45000) {
  const { signal, clear } = createTimeoutController(timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }
    return { response, text, json };
  } finally {
    clear();
  }
}

function sanitizeLoginResponse(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  return {
    user: payload.user || null,
    jwtPresent: Boolean(payload.jwt),
    jwtLength: payload.jwt ? String(payload.jwt).length : 0
  };
}

function deriveStudentId(loginPayload, config) {
  const configured = Number(config.studentId);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  const user = loginPayload?.user || {};

  const direct = Number(user?.associatedStudent?.id);
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }

  const parentLinked = user?.associatedParents?.find((entry) => Number.isFinite(Number(entry?.student?.id)));
  if (parentLinked?.student?.id) {
    return Number(parentLinked.student.id);
  }

  const fallbackLists = [user.students, user.children, user.associatedChildren];
  for (const list of fallbackLists) {
    if (!Array.isArray(list)) continue;
    const match = list.find((entry) => Number.isFinite(Number(entry?.id || entry?.student?.id)));
    if (match?.id) return Number(match.id);
    if (match?.student?.id) return Number(match.student.id);
  }

  throw new Error(
    'Konnte keine Schüler-ID aus der Login-Antwort ermitteln. Falls nötig, bitte SCHULMANAGER_STUDENT_ID in der .env setzen.'
  );
}

function extractMainScriptPath(html) {
  const matches = [...String(html || '').matchAll(/<script[^>]+src=["']([^"']*main-[^"']+\.js)["']/gi)];
  return matches[0]?.[1] || null;
}

function extractChunkPaths(mainScript) {
  return [...new Set((String(mainScript || '').match(/chunk-[A-Z0-9]+\.js/g) || []).map((name) => `static/${name}`))];
}

function findBundleVersionInChunk(scriptText) {
  const text = String(scriptText || '');

  let match = text.match(/bundleVersion\s*:\s*['"]([a-f0-9]{8,})['"]/i);
  if (match) return match[1];

  match = text.match(/var\s+([A-Za-z_$][\w$]*)\s*=\s*['"]([a-f0-9]{8,})['"];[\s\S]{0,4000}?bundleVersion\s*:\s*\1/i);
  if (match) return match[2];

  match = text.match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*['"]([a-f0-9]{8,})['"];[\s\S]{0,4000}?bundleVersion\s*:\s*\1/i);
  if (match) return match[2];

  return null;
}

async function discoverBundleVersion(config) {
  const dashboardUrl = `${config.baseUrl}/#/dashboard`;
  const dashboard = await fetchJson(dashboardUrl, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': config.userAgent
    }
  }, config.playwrightTimeoutMs);

  if (!dashboard.response.ok) {
    throw new Error(`Konnte Dashboard-HTML nicht laden (HTTP ${dashboard.response.status}).`);
  }

  const mainPath = extractMainScriptPath(dashboard.text);
  if (!mainPath) {
    throw new Error('Konnte main-*.js im Dashboard-HTML nicht finden.');
  }

  const mainUrl = new URL(mainPath, `${config.baseUrl}/`).toString();
  const mainScript = await fetchJson(mainUrl, {
    headers: {
      'Accept': 'application/javascript,text/javascript,*/*;q=0.1',
      'User-Agent': config.userAgent,
      'Referer': dashboardUrl
    }
  }, config.playwrightTimeoutMs);

  if (!mainScript.response.ok) {
    throw new Error(`Konnte main-Skript nicht laden (HTTP ${mainScript.response.status}).`);
  }

  const chunkPaths = extractChunkPaths(mainScript.text);
  for (const chunkPath of chunkPaths) {
    const chunkUrl = new URL(chunkPath, `${config.baseUrl}/`).toString();
    const chunk = await fetchJson(chunkUrl, {
      headers: {
        'Accept': 'application/javascript,text/javascript,*/*;q=0.1',
        'User-Agent': config.userAgent,
        'Referer': dashboardUrl
      }
    }, config.playwrightTimeoutMs);

    if (!chunk.response.ok) continue;

    const version = findBundleVersionInChunk(chunk.text);
    if (version) {
      return {
        version,
        discoveredFrom: chunkPath,
        mainScriptPath: mainPath,
        checkedChunks: chunkPaths.length
      };
    }
  }

  throw new Error('Konnte bundleVersion in den geladenen Frontend-Skripten nicht finden.');
}

async function resolveBundleVersion(config) {
  const cachePath = path.join(config.stateDir, 'bundle-version.json');
  const cached = readJson(cachePath, null);
  if (cached?.version) {
    return cached;
  }

  const discovered = await discoverBundleVersion(config);
  writeJson(cachePath, discovered);
  return discovered;
}

async function login(config) {
  if (!config.username || !config.password) {
    throw new Error('Keine Zugangsdaten konfiguriert. Bitte SCHULMANAGER_USERNAME und SCHULMANAGER_PASSWORD setzen.');
  }

  const saltResult = await fetchJson(`${config.baseUrl}/api/get-salt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Origin': config.baseUrl,
      'Referer': `${config.baseUrl}/`,
      'User-Agent': config.userAgent
    },
    body: JSON.stringify({
      emailOrUsername: config.username,
      institutionId: null
    })
  }, config.playwrightTimeoutMs);

  if (!saltResult.response.ok) {
    throw new Error(`Salt-Abruf fehlgeschlagen (HTTP ${saltResult.response.status}).`);
  }

  const loginResult = await fetchJson(`${config.baseUrl}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Origin': config.baseUrl,
      'Referer': `${config.baseUrl}/`,
      'User-Agent': config.userAgent
    },
    body: JSON.stringify({
      emailOrUsername: config.username,
      password: config.password,
      hash: null,
      mobileApp: false,
      institutionId: null
    })
  }, config.playwrightTimeoutMs);

  writeJson(path.join(config.logsDir, 'login-response-sanitized.json'), sanitizeLoginResponse(loginResult.json));

  if (!loginResult.response.ok) {
    throw new Error(`Login fehlgeschlagen (HTTP ${loginResult.response.status}).`);
  }

  if (!loginResult.json?.jwt) {
    writeText(path.join(config.logsDir, 'login-response-raw.txt'), loginResult.text || '');
    throw new Error('Login-Antwort enthält kein JWT. Die Rohantwort wurde unter data/logs/login-response-raw.txt gespeichert.');
  }

  const studentId = deriveStudentId(loginResult.json, config);

  return {
    token: loginResult.json.jwt,
    studentId,
    user: loginResult.json.user || null
  };
}

async function requestHomework(config, token, studentId, bundleVersion) {
  const body = {
    bundleVersion,
    requests: [
      {
        moduleName: 'classbook',
        endpointName: 'get-homework',
        parameters: {
          student: { id: studentId }
        }
      }
    ]
  };

  const result = await fetchJson(`${config.baseUrl}/api/calls`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Origin': config.baseUrl,
      'Referer': `${config.baseUrl}/`,
      'User-Agent': config.userAgent
    },
    body: JSON.stringify(body)
  }, config.playwrightTimeoutMs);

  writeJson(path.join(config.logsDir, 'homework-api-response.json'), result.json || { rawText: result.text || '' });

  if (!result.response.ok) {
    throw new Error(`Hausaufgaben-Abruf fehlgeschlagen (HTTP ${result.response.status}).`);
  }

  return result.json;
}

function extractHomeworkItems(apiResponse) {
  const result = apiResponse?.results?.[0];
  if (!result) {
    throw new Error('Die API-Antwort enthält kein Ergebnis für get-homework.');
  }

  if (result.status !== 200) {
    throw new Error(`get-homework lieferte Status ${result.status}. Details siehe data/logs/homework-api-response.json`);
  }

  const data = Array.isArray(result.data) ? result.data : [];
  return data.map(normalizeItem);
}

async function collectHomework(config) {
  ensureDir(config.logsDir);

  const auth = await login(config);
  let bundleInfo = await resolveBundleVersion(config);

  let apiResponse = await requestHomework(config, auth.token, auth.studentId, bundleInfo.version);
  let resultStatus = apiResponse?.results?.[0]?.status;

  if (resultStatus && resultStatus !== 200) {
    const cachePath = path.join(config.stateDir, 'bundle-version.json');
    const refreshed = await discoverBundleVersion(config);
    writeJson(cachePath, refreshed);
    bundleInfo = refreshed;
    apiResponse = await requestHomework(config, auth.token, auth.studentId, bundleInfo.version);
    resultStatus = apiResponse?.results?.[0]?.status;
  }

  const items = extractHomeworkItems(apiResponse);

  return {
    source: {
      method: 'direct-api',
      url: `${config.baseUrl}/api/calls`,
      studentId: auth.studentId,
      bundleVersion: bundleInfo.version,
      bundleDiscoveredFrom: bundleInfo.discoveredFrom || null,
      userId: auth.user?.id || null
    },
    responseStatus: resultStatus || 200,
    items
  };
}

module.exports = { collectHomework };
