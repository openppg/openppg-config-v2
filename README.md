# OpenPPG Config

 Configure your OpenPPG controller via WebUSB

### Notes:

- Currently only works in Google Chrome and related chromium variants (like Brave browser and new Microsoft Edge) https://caniuse.com/webusb
- Also tested and working in Chrome on Android
- In Windows you may have to enable the new USB backed by navigating to `chrome://flags/#new-usb-backend`

### Requirements

OpenPPG config uses Doks and a number of other npm packages. Installing npm is pretty simple. Download and install [Node.js](https://nodejs.org/) (it includes npm) for your platform. I recommend installing the current release.

### Local development

#### 1. Install npm packages

```bash
npm install
```

#### 2. Start local development server

```bash
npm run start
```

#### 3. (Optional)  Build files
When ready to publish to a static hosting site

```bash
npm run build
```
