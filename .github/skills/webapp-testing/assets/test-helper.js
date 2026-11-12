/**
 * Helper utilities for web application testing with Playwright.
 */

async function waitForCondition(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error('Condition not met within timeout');
}

function captureConsoleLogs(page) {
  const logs = [];
  page.on('console', (message) => {
    logs.push({
      type: message.type(),
      text: message.text(),
      timestamp: new Date().toISOString()
    });
  });
  return logs;
}

async function captureScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Screenshot saved: ${filename}`);
  return filename;
}

module.exports = { waitForCondition, captureConsoleLogs, captureScreenshot };
