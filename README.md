# OpenPPG Config

Configure your OpenPPG controller via WebUSB

[![Deploy Hugo site to Pages](https://github.com/openppg/openppg-config-v2/actions/workflows/pages.yml/badge.svg)](https://github.com/openppg/openppg-config-v2/actions/workflows/pages.yml)
[![Hyas CI](https://github.com/openppg/openppg-config-v2/actions/workflows/node.js-ci.yml/badge.svg)](https://github.com/openppg/openppg-config-v2/actions/workflows/node.js-ci.yml)

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

To interact with WebUSB devices you must use *https*. Hugo now provides https server out of the box. You can access the site at https://localhost:1313.

```bash
npm run start
```

#### 3. (Not required) Build files

*Github actions now auto-builds and deploys code when merged/commited into the master branch*

When ready to publish to a static hosting site

```bash
npm run build
```

### Staging Deployment

Staging is hosted on Cloudflare Pages at `config-staging.openppg.com`. To manually deploy:

```bash
npm run build -- --baseURL "https://config-staging.openppg.com/"
wrangler pages deploy docs --project-name openppg-config-staging
```

**Note:** You must be logged into wrangler (`wrangler login`) with access to the OpenPPG Cloudflare account.

### Firmware Development

#### Building ESP32-S3 Firmware

Most updates should be firmware-only so user preferences (NVS) and partitions are preserved. For distribution, use the raw app image at `.pio/build/OpenPPG-CESP32S3-CAN-SP140/firmware.bin` (no padding/merge needed).

Note: In web installer manifests, firmware-only updates must use `offset: 65536` (hex `0x10000`). An `offset: 0` manifest flashes a full image and will overwrite bootloader/partitions/NVS.

Use a full image only for factory resets or when you need to update the bootloader/partitions. This merges all binaries into a single flashable image:

```bash
esptool.py --chip esp32s3 merge_bin \
  -o .pio/build/OpenPPG-CESP32S3-CAN-SP140/merged-firmware.bin \
  --flash_mode dio \
  --flash_freq 80m \
  --flash_size 8MB \
  0x0 .pio/build/OpenPPG-CESP32S3-CAN-SP140/bootloader.bin \
  0x8000 .pio/build/OpenPPG-CESP32S3-CAN-SP140/partitions.bin \
  0xe000 /Users/zach/.platformio/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin \
  0x10000 .pio/build/OpenPPG-CESP32S3-CAN-SP140/firmware.bin
```

This command merges the bootloader, partitions, and firmware binaries into a single flashable image for the ESP32-S3 chip used in the SP140 controller.
