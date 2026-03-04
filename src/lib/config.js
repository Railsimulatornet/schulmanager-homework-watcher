const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

function readMaybeFile(value, filePath) {
  if (value && String(value).trim() !== '') {
    return String(value).trim();
  }
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  return '';
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const config = {
  rootDir: ROOT_DIR,
  dataDir: DATA_DIR,
  profileDir: path.join(DATA_DIR, 'profile'),
  snapshotsDir: path.join(DATA_DIR, 'snapshots'),
  reportsDir: path.join(DATA_DIR, 'reports'),
  stateDir: path.join(DATA_DIR, 'state'),
  mailDir: path.join(DATA_DIR, 'mail'),
  logsDir: path.join(DATA_DIR, 'logs'),
  timezone: process.env.TZ || 'Europe/Berlin',
  baseUrl: process.env.SCHULMANAGER_BASE_URL || 'https://login.schulmanager-online.de',
  homeworkUrl:
    process.env.SCHULMANAGER_HOMEWORK_URL ||
    'https://login.schulmanager-online.de/#/modules/classbook/homework/',
  username: readMaybeFile(process.env.SCHULMANAGER_USERNAME, process.env.SCHULMANAGER_USERNAME_FILE),
  password: readMaybeFile(process.env.SCHULMANAGER_PASSWORD, process.env.SCHULMANAGER_PASSWORD_FILE),
  studentId: process.env.SCHULMANAGER_STUDENT_ID || '',
  userAgent:
    process.env.SCHULMANAGER_USER_AGENT ||
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  headless: toBoolean(process.env.HEADLESS, true),
  playwrightTimeoutMs: toNumber(process.env.PW_TIMEOUT_MS, 45000),
  cronSchedule: process.env.CRON_SCHEDULE || '0,30 6-21 * * *',
  runOnStart: toBoolean(process.env.RUN_ON_START, true),
  retentionDays: Math.max(1, toNumber(process.env.RETENTION_DAYS, 31)),
  onlyCurrentWeek: toBoolean(process.env.ONLY_CURRENT_WEEK, false),
  lookbackDays: Math.max(0, toNumber(process.env.HOMEWORK_LOOKBACK_DAYS, 10)),
  lookaheadDays: Math.max(0, toNumber(process.env.HOMEWORK_LOOKAHEAD_DAYS, 7)),
  mail: {
    enabled: toBoolean(process.env.MAIL_ENABLED, false),
    mode: process.env.MAIL_MODE || 'changes',
    onError: toBoolean(process.env.MAIL_ON_ERROR, true),
    host: process.env.SMTP_HOST || '',
    port: toNumber(process.env.SMTP_PORT, 587),
    secure: toBoolean(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: readMaybeFile(process.env.SMTP_PASS, process.env.SMTP_PASS_FILE),
    from: process.env.MAIL_FROM || '',
    to: process.env.MAIL_TO || ''
  }
};

module.exports = { config, toBoolean, toNumber, readMaybeFile };
