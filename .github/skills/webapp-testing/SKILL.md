---
description: Test local web applications in a real browser with Playwright, including forms, navigation, responsive behavior, and console errors.
name: webapp-testing
---

# Web Application Testing

Use Playwright browser automation when a real-browser check adds confidence beyond the project's existing unit or DOM smoke tests.

Before testing, verify the local server responds. Prefer accessible roles, labels, and explicit waits. Capture relevant console errors and take screenshots when investigating visible failures. Close browser and server resources after testing.

For this project, retain the existing Node.js smoke-test suite as the primary automated gate; use Playwright for browser-level verification where available. Do not install Playwright or add dependencies unless a required browser check cannot be done with existing tools.

An optional helper is available at `assets/test-helper.js`.
