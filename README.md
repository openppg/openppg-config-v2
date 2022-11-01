# OpenPPG Config

Configure your OpenPPG controller via WebUSB

[![Build and Deploy](https://github.com/openppg/openppg-config-v2/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/openppg/openppg-config-v2/actions/workflows/pages/pages-build-deployment)

### Notes:

- Currently only works in Google Chrome and related chromium variants (like Brave browser and latest Microsoft Edge) https://caniuse.com/webusb
- Also tested and working in Chrome on Android
- In Windows you may have to enable the new USB backed by navigating to `chrome://flags/#new-usb-backend`

### Requirements

OpenPPG config uses [Doks](https://github.com/h-enk/doks) and a number of other npm packages. Installing npm is pretty simple. Download and install [Node.js](https://nodejs.org/) (it includes npm) for your platform. We recommend installing the most recent LTS release.

### Local development

#### 1. Install npm packages

```bash
npm install
```

#### 2. Start local development server

```bash
npm run start
```

#### 3. (Not required)  Build files

*Github actions now auto-builds and deploys code when merged/commited into the master branch*

When ready to publish to a static hosting site

```bash
npm run build
```
