import {Config} from '@remotion/cli/config';
import fs from 'node:fs';

// 入口走 Remotion 的默认约定：src/index.ts。组件库在 code/，两处共用根目录的 node_modules
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

/**
 * 优先用本机已有的 Chrome / Edge，不要为了渲染去下载一个 300MB 的 headless shell。
 *
 * Remotion 找不到浏览器时会自己下 chrome-headless-shell —— 慢，而且占空间。
 * 这里先探一遍常见路径，找到就用；一个都没有时才让它自己下（那时 check_env.py
 * 会提示你装 Chrome）。
 *
 * 想指定自己的浏览器：设置环境变量 CHROME_PATH。
 */
const CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

const found = CANDIDATES.find((p) => p && fs.existsSync(p));
if (found) {
  Config.setBrowserExecutable(found);
  // eslint-disable-next-line no-console
  console.log('[guangyu] 使用本机浏览器：' + found);
} else {
  // eslint-disable-next-line no-console
  console.log('[guangyu] 没找到本机 Chrome/Edge，将使用 Remotion 自带的无头浏览器');
}
