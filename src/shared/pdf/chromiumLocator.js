/**
 * AlertMind — Chromium Executable Locator
 * Finds a usable Chrome/Edge binary for Puppeteer's PDF export.
 *
 * Priority order:
 *   1. PUPPETEER_EXECUTABLE_PATH env var (explicit override — always wins)
 *   2. Common install paths for Chrome/Edge on the current OS
 *   3. Throws a clear, actionable error if nothing is found
 *
 * This matters specifically because AlertMind no longer requires Docker
 * (which used to bundle its own Chromium via Alpine's `chromium` package).
 * Most Windows/Mac users already have Chrome or Edge installed — this
 * reuses it instead of requiring a second ~200MB Chromium download.
 */

import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import { getConfig } from '../../config/env.js';

const CANDIDATE_PATHS = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge',
    '/snap/bin/chromium',
  ],
};

/**
 * Locates a Chrome/Edge/Chromium executable to hand to Puppeteer.
 * @returns {string} Absolute path to the executable
 * @throws {Error} If no browser could be found — message tells the user exactly what to do
 */
export function findChromiumExecutable() {
  const config = getConfig();

  if (config.PUPPETEER_EXECUTABLE_PATH) {
    if (!existsSync(config.PUPPETEER_EXECUTABLE_PATH)) {
      throw new Error(
        `PUPPETEER_EXECUTABLE_PATH is set to "${config.PUPPETEER_EXECUTABLE_PATH}" but that file does not exist. ` +
        `Check the path in your .env file.`
      );
    }
    return config.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidates = CANDIDATE_PATHS[platform()] || [];
  const found = candidates.find((path) => existsSync(path));

  if (found) return found;

  throw new Error(
    'No Chrome, Edge, or Chromium browser could be found for PDF export. ' +
    'Install Google Chrome (chrome.com) or Microsoft Edge, or set PUPPETEER_EXECUTABLE_PATH ' +
    'in your .env file to the full path of a Chrome/Edge/Chromium executable.'
  );
}
