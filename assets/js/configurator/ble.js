/* eslint-disable no-console */

const CONFIG_SERVICE_UUID = '1779a55b-deb8-4482-a5d1-a12e62146138';
const DEVICE_INFO_SERVICE_UUID = '0000180a-0000-1000-8000-00805f9b34fb';

const CHAR_UUIDS = {
  DEVICE_STATE: '8f80bcf5-b58f-4908-b079-e8ad6f5ee257',
  METRIC_ALT: 'df63f19e-7295-4a44-a0dc-184d1afeddf7',
  PERFORMANCE_MODE: 'd76c2e92-3547-4f5f-afb4-515c5c08b06b',
  SCREEN_ROTATION: '9cbab736-3705-4ecf-8086-fb7c5fb86282',
  SEA_PRESSURE: 'db47e20e-d8c1-405a-971a-da0a2df7e0f6',
  THEME: 'ad0e4309-1eb2-461a-b36c-697b2e1604d2',
  FW_VERSION: '00002a26-0000-1000-8000-00805f9b34fb',
  HW_REVISION: '00002a27-0000-1000-8000-00805f9b34fb',
  ARMED_TIME: '58b29259-43ef-4593-b700-250ec839a2b2',
  DEVICE_UNIQUE_ID: 'b1571560-345f-4974-a14d-66e98740232f',
};

const DEVICE_STATE_LABELS = {
  0: 'Disarmed',
  1: 'Armed',
  2: 'Cruise',
};

const SETTING_SPECS = {
  screen_rot: {
    uuid: CHAR_UUIDS.SCREEN_ROTATION,
    type: 'u8',
    group: 'screen_rot',
    read: value => value.getUint8(0),
    expected: value => [value],
    requiresReboot: true,
  },
  theme: {
    uuid: CHAR_UUIDS.THEME,
    type: 'u8',
    group: 'theme',
    read: value => value.getUint8(0),
    expected: value => [value],
    optional: true,
    requiresReboot: true,
  },
  units: {
    uuid: CHAR_UUIDS.METRIC_ALT,
    type: 'u8',
    group: 'units',
    read: value => value.getUint8(0),
    expected: value => [value],
  },
  performance_mode: {
    uuid: CHAR_UUIDS.PERFORMANCE_MODE,
    type: 'u8',
    group: 'performance_mode',
    read: value => value.getUint8(0),
    expected: value => [value],
  },
  sea_pressure: {
    uuid: CHAR_UUIDS.SEA_PRESSURE,
    type: 'f32',
    inputId: 'sea-pressure',
    read: value => value.getFloat32(0, true),
    expected: value => {
      const buffer = new ArrayBuffer(4);
      new DataView(buffer).setFloat32(0, value, true);
      return Array.from(new Uint8Array(buffer));
    },
  },
};

let device;
let server;
let configService;
let deviceInfoService;
let gattQueue = Promise.resolve();
let connectionStatus;
let supportWarning;
let supportMessage;
let deviceInfoDiv;
let settingsFieldset;
let settingsOverlay;
let currentDeviceState = null;
let characteristicCache = new Map();
let saveStatusTimer;
let statusClearTimer;

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  setupEventListeners();
  checkBluetoothSupport();
});

function cacheElements() {
  connectionStatus = document.getElementById('connection-status');
  supportWarning = document.getElementById('ble-support-warning');
  supportMessage = document.getElementById('ble-support-message');
  deviceInfoDiv = document.getElementById('device-info');
  settingsFieldset = document.getElementById('settings-fieldset');
  settingsOverlay = document.getElementById('settings-overlay');
}

function setupEventListeners() {
  document.getElementById('connect-ble')?.addEventListener('click', connect);
  document.getElementById('disconnect-ble')?.addEventListener('click', disconnect);
  document.getElementById('refresh-ble')?.addEventListener('click', readAllData);

  Object.entries(SETTING_SPECS).forEach(([key, spec]) => {
    if (spec.group) {
      document.querySelectorAll(`input[name="${spec.group}"]`).forEach(el => {
        el.addEventListener('change', event => {
          if (event.target.checked) {
            writeSetting(key, parseInt(event.target.value, 10));
          }
        });
      });
    }

    if (spec.inputId) {
      document.getElementById(spec.inputId)?.addEventListener('change', event => {
        const value = clampSeaPressure(parseFloat(event.target.value));
        if (Number.isFinite(value)) {
          event.target.value = value.toFixed(2);
          writeSetting(key, value);
        }
      });
    }
  });
}

async function checkBluetoothSupport() {
  if (!window.isSecureContext) {
    showSupportWarning('Web Bluetooth requires HTTPS or localhost. Open this page over a secure origin.');
    setConnectEnabled(false);
    updateStatus('Bluetooth is unavailable on this origin.', 'error');
    return;
  }

  if (!('bluetooth' in navigator)) {
    showSupportWarning('Web Bluetooth is not available in this browser. Use Chrome or Edge on a supported desktop or Android device.');
    setConnectEnabled(false);
    updateStatus('Web Bluetooth is not supported in this browser.', 'error');
    return;
  }

  try {
    const available = await navigator.bluetooth.getAvailability();
    if (!available) {
      showSupportWarning('Bluetooth is disabled or unavailable. Turn on Bluetooth, then refresh this page.');
      updateStatus('Bluetooth adapter unavailable.', 'warning');
      return;
    }
  } catch (error) {
    console.warn('Bluetooth availability check failed', error);
  }

  hideSupportWarning();
  setConnectEnabled(true);
}

function showSupportWarning(message) {
  if (supportMessage) supportMessage.textContent = message;
  supportWarning?.classList.remove('d-none');
}

function hideSupportWarning() {
  supportWarning?.classList.add('d-none');
}

function setConnectEnabled(enabled) {
  const connectBtn = document.getElementById('connect-ble');
  if (connectBtn) connectBtn.disabled = !enabled;
}

function queueGatt(label, operation) {
  const run = gattQueue.then(operation, operation);
  gattQueue = run.catch(error => {
    console.warn(`GATT operation failed: ${label}`, error);
  });
  return run;
}

async function connect() {
  try {
    setConnectEnabled(false);
    updateStatus('Select your SP140 controller...');

    device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [CONFIG_SERVICE_UUID] },
        { namePrefix: 'OpenPPG SP140' },
        { name: 'OpenPPG Controller' },
      ],
      optionalServices: [CONFIG_SERVICE_UUID, DEVICE_INFO_SERVICE_UUID],
    });

    device.addEventListener('gattserverdisconnected', onDisconnected);

    updateStatus('Connecting...');
    server = await queueGatt('connect', () => device.gatt.connect());
    characteristicCache = new Map();

    updateStatus('Getting services...');
    configService = await queueGatt('config service', () => server.getPrimaryService(CONFIG_SERVICE_UUID));
    try {
      deviceInfoService = await queueGatt('device info service', () => server.getPrimaryService(DEVICE_INFO_SERVICE_UUID));
    } catch (error) {
      deviceInfoService = null;
      console.warn('Device Info Service not found', error);
    }

    updateUIConnected();
    await subscribeDeviceState();
    await readAllData();
  } catch (error) {
    console.error('Connection failed', error);
    updateStatus(`Connection failed: ${error.message}`, 'error');
    setConnectEnabled(true);
  }
}

function onDisconnected() {
  updateUIDisconnected();
  updateStatus('Disconnected', 'warning');
}

async function disconnect() {
  if (device?.gatt?.connected) {
    device.gatt.disconnect();
  } else {
    onDisconnected();
  }
}

function updateStatus(message, type = 'info', options = {}) {
  if (!connectionStatus) return;
  if (statusClearTimer) {
    clearTimeout(statusClearTimer);
    statusClearTimer = null;
  }

  const icon = {
    info: 'fa-info-circle',
    success: 'fa-check-circle',
    warning: 'fa-exclamation-triangle',
    error: 'fa-times-circle',
  }[type] || 'fa-info-circle';
  const color = {
    info: 'text-muted',
    success: 'text-success',
    warning: 'status-warning',
    error: 'text-danger',
  }[type] || 'text-muted';

  connectionStatus.className = `small ${color}`;
  const iconEl = document.createElement('i');
  iconEl.className = `fas ${icon} me-1`;
  connectionStatus.replaceChildren(iconEl, document.createTextNode(` ${message}`));

  if (options.transientMs) {
    statusClearTimer = setTimeout(() => {
      connectionStatus.replaceChildren();
      connectionStatus.className = 'small text-muted';
      statusClearTimer = null;
    }, options.transientMs);
  }
}

function updateUIConnected() {
  document.getElementById('connect-ble')?.classList.add('d-none');
  document.getElementById('disconnect-ble')?.classList.remove('d-none');
  document.getElementById('refresh-ble')?.removeAttribute('disabled');
  deviceInfoDiv?.classList.remove('d-none');
  if (settingsOverlay) settingsOverlay.classList.add('d-none');
  setSettingsEnabled(true);
  updateStatus('Device must be disarmed to change settings.');
}

function updateUIDisconnected() {
  document.getElementById('connect-ble')?.classList.remove('d-none');
  document.getElementById('disconnect-ble')?.classList.add('d-none');
  document.getElementById('refresh-ble')?.setAttribute('disabled', 'disabled');
  deviceInfoDiv?.classList.add('d-none');
  setSettingsEnabled(false);
  if (settingsOverlay) settingsOverlay.classList.remove('d-none');
  currentDeviceState = null;
  configService = null;
  deviceInfoService = null;
  characteristicCache = new Map();
  setConnectEnabled(true);
}

function setSettingsEnabled(enabled) {
  if (settingsFieldset) settingsFieldset.disabled = !enabled;
}

function updateDeviceState(state) {
  currentDeviceState = state;
  const stateLabel = DEVICE_STATE_LABELS[state] || `Unknown (${state})`;
  setText('info-device-state', stateLabel);

  if (state === 0) {
    setSettingsEnabled(true);
    updateStatus('Device is disarmed. Settings can be changed.', 'success');
  } else {
    setSettingsEnabled(false);
    updateStatus(`Device is ${stateLabel.toLowerCase()}. Disarm before changing settings.`, 'warning');
  }
}

async function subscribeDeviceState() {
  try {
    const characteristic = await getConfigCharacteristic(CHAR_UUIDS.DEVICE_STATE);
    const value = await queueGatt('read device state', () => characteristic.readValue());
    if (value.byteLength > 0) updateDeviceState(value.getUint8(0));

    if (characteristic.properties.notify || characteristic.properties.indicate) {
      await queueGatt('start device state notifications', () => characteristic.startNotifications());
      characteristic.addEventListener('characteristicvaluechanged', event => {
        const stateValue = event.target.value;
        if (stateValue.byteLength > 0) updateDeviceState(stateValue.getUint8(0));
      });
    }
  } catch (error) {
    console.warn('Device state characteristic unavailable', error);
    currentDeviceState = null;
  }
}

async function readAllData() {
  if (!configService) return;

  const refreshBtn = document.getElementById('refresh-ble');
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    await readDeviceInfo();
    await readStatusCharacteristics();
    await readSettings();
    updateStatus(
      currentDeviceState === 0 || currentDeviceState === null
        ? 'Settings refreshed.'
        : 'Status refreshed. Disarm before changing settings.',
      currentDeviceState === 0 || currentDeviceState === null ? 'success' : 'warning',
      currentDeviceState === 0 || currentDeviceState === null ? { transientMs: 3000 } : {},
    );
  } catch (error) {
    console.error('Error reading data', error);
    updateStatus(`Failed to refresh settings: ${error.message}`, 'error');
  } finally {
    if (refreshBtn && configService) refreshBtn.disabled = false;
  }
}

async function readDeviceInfo() {
  const fwVal = await readOptionalConfigCharacteristic(CHAR_UUIDS.FW_VERSION);
  if (fwVal) setText('info-fw-version', formatFirmwareVersion(fwVal));

  const hwVal = await readOptionalConfigCharacteristic(CHAR_UUIDS.HW_REVISION);
  if (hwVal && hwVal.byteLength > 0) setText('info-hw-revision', `Rev ${hwVal.getUint8(0)}`);

  if (deviceInfoService) {
    const idVal = await readOptionalCharacteristic(
      deviceInfoService,
      CHAR_UUIDS.DEVICE_UNIQUE_ID,
      'device unique id',
    );
    if (idVal) setText('info-serial', decodeText(idVal) || '-');
  }
}

async function readStatusCharacteristics() {
  const stateVal = await readOptionalConfigCharacteristic(CHAR_UUIDS.DEVICE_STATE);
  if (stateVal && stateVal.byteLength > 0) updateDeviceState(stateVal.getUint8(0));

  const armedVal = await readOptionalConfigCharacteristic(CHAR_UUIDS.ARMED_TIME);
  if (armedVal && armedVal.byteLength >= 2) {
    setText('info-armed-time', formatDurationMinutes(armedVal.getUint16(0, true)));
  }
}

async function readSettings() {
  for (const [key, spec] of Object.entries(SETTING_SPECS)) {
    try {
      const characteristic = await getConfigCharacteristic(spec.uuid);
      const value = await queueGatt(`read ${key}`, () => characteristic.readValue());
      const parsed = spec.read(value);
      applySettingToUi(spec, parsed);
      setSettingAvailable(spec, true);
    } catch (error) {
      console.warn(`Setting ${key} unavailable`, error);
      if (!spec.optional) {
        setSettingAvailable(spec, false);
      }
    }
  }
}

function applySettingToUi(spec, value) {
  if (spec.group) {
    const radio = document.querySelector(`input[name="${spec.group}"][value="${value}"]`);
    if (radio) radio.checked = true;
  }

  if (spec.inputId) {
    const input = document.getElementById(spec.inputId);
    if (input && Number.isFinite(value)) input.value = value.toFixed(2);
  }
}

function setSettingAvailable(spec, available) {
  const nodes = [];
  if (spec.group) nodes.push(...document.querySelectorAll(`input[name="${spec.group}"]`));
  if (spec.inputId) nodes.push(document.getElementById(spec.inputId));
  nodes.filter(Boolean).forEach(node => {
    node.disabled = !available;
  });
}

async function writeSetting(key, value) {
  if (!configService) return;
  if (currentDeviceState !== null && currentDeviceState !== 0) {
    updateStatus('Disarm the controller before changing settings.', 'warning');
    return;
  }

  const spec = SETTING_SPECS[key];
  if (!spec) return;

  try {
    const characteristic = await getConfigCharacteristic(spec.uuid);
    const payload = encodeValue(spec.type, value);

    await queueGatt(`write ${key}`, () => writeCharacteristic(characteristic, payload));
    const confirmed = await queueGatt(`confirm ${key}`, () => characteristic.readValue());
    const expected = spec.expected(value);

    if (!bytesEqual(dataViewToBytes(confirmed), expected)) {
      throw new Error('Firmware readback did not match the requested value.');
    }

    applySettingToUi(spec, value);
    showSaved();
    updateStatus('Setting saved.', 'success');
    if (spec.requiresReboot) showRebootAlert();
  } catch (error) {
    console.error('Write failed', error);
    updateStatus(`Failed to save setting: ${error.message}`, 'error');
    await readSettings();
  }
}

async function writeCharacteristic(characteristic, payload) {
  if (characteristic.properties.write && 'writeValueWithResponse' in characteristic) {
    return characteristic.writeValueWithResponse(payload);
  }
  if (characteristic.properties.writeWithoutResponse && 'writeValueWithoutResponse' in characteristic) {
    return characteristic.writeValueWithoutResponse(payload);
  }
  return characteristic.writeValue(payload);
}

async function getConfigCharacteristic(uuid) {
  return getCharacteristic(configService, uuid, `config ${uuid}`);
}

async function getCharacteristic(service, uuid, label) {
  const cacheKey = `${service.uuid}:${uuid}`.toLowerCase();
  if (characteristicCache.has(cacheKey)) return characteristicCache.get(cacheKey);

  const characteristic = await queueGatt(`get ${label}`, () => service.getCharacteristic(uuid));
  characteristicCache.set(cacheKey, characteristic);
  return characteristic;
}

async function readOptionalConfigCharacteristic(uuid) {
  return readOptionalCharacteristic(configService, uuid, `config ${uuid}`);
}

async function readOptionalCharacteristic(service, uuid, label) {
  if (!service) return null;
  try {
    const characteristic = await getCharacteristic(service, uuid, label);
    return await queueGatt(`read ${label}`, () => characteristic.readValue());
  } catch (error) {
    console.warn(`${label} unavailable`, error);
    return null;
  }
}

function encodeValue(type, value) {
  if (type === 'u8') return new Uint8Array([value & 0xFF]);

  if (type === 'f32') {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, value, true);
    return new Uint8Array(buffer);
  }

  throw new Error(`Unsupported setting type: ${type}`);
}

function dataViewToBytes(value) {
  return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function formatFirmwareVersion(value) {
  if (value.byteLength < 2) return '-';
  const major = value.getUint8(0);
  const minor = value.getUint8(1);
  if (value.byteLength >= 6) {
    return `v${major}.${minor}.${value.getUint32(2, true)}`;
  }
  if (value.byteLength >= 4) {
    return `v${major}.${minor}.${value.getUint16(2, true)}`;
  }
  return `v${major}.${minor}`;
}

function formatDurationMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function decodeText(value) {
  return new TextDecoder().decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)).trim();
}

function clampSeaPressure(value) {
  if (!Number.isFinite(value)) return NaN;
  return Math.max(300, Math.min(1200, value));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function showSaved() {
  const saveStatus = document.getElementById('save-status');
  if (!saveStatus) return;

  if (saveStatusTimer) clearTimeout(saveStatusTimer);
  saveStatus.classList.add('show');
  saveStatusTimer = setTimeout(() => {
    saveStatus.classList.remove('show');
  }, 2000);
}

function showRebootAlert() {
  document.getElementById('reboot-alert')?.classList.remove('d-none');
}
