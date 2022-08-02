/* eslint-disable no-undef */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    let connectButton = document.querySelector('#connect');
    let statusDisplay = document.querySelector('#status');
    let port;

    $('#frm-config :input').prop('disabled', true);

    // check if WebUSB is supported
    if ('usb' in navigator) {
      console.log('has WebUSB support');
    } else {
      alert('WebUSB not supported: Please use Chrome on desktop or Android');
      $('#connect').prop('disabled', true);
      $('#connect').html('Not Supported');
      return;
    }

    document.getElementById('btn-pressure').addEventListener('click', function () {
      updateLocalPressure();
    });

    // listen for form input changes and save them to the device
    $('#frm-config input').on('change', function () {
      var orientation = $('input[name=orientation]:checked', '#frm-config').val();
      var baro_calibration = $('input#seaPressureInput').val();
      var min_batt_v = $('input#minBattInput').val();
      var max_batt_v = $('input#maxBattInput').val();
      var metric_alt = $('#units-alt').prop('checked');
      var performance_mode = $('#performance-sport').prop('checked') ? 1 : 0;

      var usb_json = {
        'major_v': 5,
        'minor_v': 0,
        'screen_rot': orientation,
        'sea_pressure': parseFloat(baro_calibration),
        'metric_alt': metric_alt,
        'min_batt_v': min_batt_v,
        'max_batt_v': max_batt_v,
        'performance_mode': performance_mode,
      }
      console.log('sending', usb_json);
      sendJSON(usb_json);
      $('#saved-status').removeClass('blink');
      $('#saved-status').width(); // trigger a DOM reflow
      $('#saved-status').addClass('blink');
    });

    document.querySelector('button#bl').addEventListener('click', function(){
      let bl_command_json = { 'command': 'rbl' };
      console.log('sending', bl_command_json);
      sendJSON(bl_command_json);
      disconnect();
    });

    // called when button is clicked
    function connect() {
      port.connect().then(() => {
        statusDisplay.textContent = '';
        connectButton.textContent = 'Disconnect';
        $('#frm-config :input').prop('disabled', false);

        port.onReceive = data => {
          let textDecoder = new TextDecoder();
          var usb_input = textDecoder.decode(data);
          if (usb_input.length < 5) { return }
          var usb_parsed = JSON.parse(usb_input); // TODO figure out why empty data is sent
          updateFormFromSync(usb_parsed);
          Rollbar.info('Synced-SP140', usb_parsed);
        };
        port.onReceiveError = error => {
          Rollbar.warn(error);
          console.error(error);
        };
      }, error => {
        Rollbar.warn(error);
        displayError(error)
      });
    }

    // Update the page from received data
    function updateFormFromSync(usb_parsed){
      console.log('raw', usb_parsed);
      if (usesNewMapping(usb_parsed)){
        usb_parsed = migrateUsbData(usb_parsed);
        console.log('parsed', usb_parsed);
      }
      else{
        usb_parsed.arch = 'SAMD21';
      }
      usb_parsed = sanitizeUsbData(usb_parsed);
      console.log('sanitized', usb_parsed);

      $('#armedTime').text(displayTime(usb_parsed.armed_time));
      $('#deviceId').text(usb_parsed.device_id);
      $('#deviceArch').text(usb_parsed.arch);
      $('#versionMajor').text(usb_parsed.major_v);
      $('#versionMinor').text(usb_parsed.minor_v);
      $('#orientation-lh').prop('checked', usb_parsed.screen_rot == 3);
      $('#orientation-rh').prop('checked', usb_parsed.screen_rot == 1);
      $('#units-alt').prop('checked', usb_parsed.metric_alt);
      $('#seaPressureInput').val(usb_parsed.sea_pressure);
      $('#performance-chill').prop('checked', usb_parsed.performance_mode == 0);
      $('#performance-sport').prop('checked', usb_parsed.performance_mode == 1);
    }

    // migrate new data to old mappings
    function migrateUsbData(usb_parsed){
      const key_map = [];
      key_map['mj_v'] = 'major_v';
      key_map['mi_v'] = 'minor_v';
      key_map['arch'] = 'arch';
      key_map['scr_rt'] = 'screen_rot';
      key_map['ar_tme'] = 'armed_time';
      key_map['m_tmp'] = 'metric_temp';
      key_map['m_alt'] = 'metric_alt';
      key_map['prf'] = 'performance_mode';
      key_map['sea_p'] = 'sea_pressure';
      key_map['id'] = 'device_id';
      var migratedUsbData = {};
      for (const [key, value] of Object.entries(usb_parsed)) {
        migratedUsbData[key_map[key]] = value;
      }
      return migratedUsbData;
    }

    // clean up string numbers to be numbers
    function sanitizeUsbData(usb_parsed){
      usb_parsed.screen_rot = parseInt(usb_parsed.screen_rot);
      usb_parsed.performance_mode = parseInt(usb_parsed.performance_mode);
      return usb_parsed;
    }

    // check if version is at least 5.5
    function usesNewMapping(usb_parsed){
      return (usb_parsed?.mj_v >= 5 && usb_parsed?.mi_v >= 5)
    }

    function displayError(error) {
      console.log(error);
      statusDisplay.textContent = error.message;
    }

    // format minutes to HH:MM
    function displayTime(minutes) {
      const format = val => `0${Math.floor(val)}`.slice(-2)
      const hours = minutes / 60

      return [hours, minutes % 60].map(format).join(':')
    }

    connectButton.addEventListener('click', function () {
      if (port) {
        disconnect();
      } else {
        serial.requestPort().then(selectedPort => {
          port = selectedPort;
          connect();
        }).catch(error => {
          displayError(error);
        });
      }
    });

    serial.getPorts().then(ports => {
      if (ports.length === 0) {
        statusDisplay.textContent = 'No device found.';
      } else {
        statusDisplay.textContent = 'Connecting...';
        port = ports[0];
        connect();
      }
    });

    function disconnect() {
      port.disconnect();
      $('#frm-config :input').prop('disabled', true);
      connectButton.textContent = 'Connect';
      statusDisplay.textContent = '';
      port = null;
    }

    function sendJSON(usb_json) {
      port.send(new TextEncoder('utf-8').encode(JSON.stringify(usb_json)));
    }
  });
})();
