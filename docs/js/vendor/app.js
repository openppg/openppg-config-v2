/* eslint-disable no-undef */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', e => {
    let connectButton = document.querySelector('#connect');
    let statusDisplay = document.querySelector('#status');
    let port;
    $('#frm-config :input').prop('disabled', true);

    // check if WebUSB is supported
    if ('usb' in navigator)
      { console.log('has WebUSB support'); }
    else {
      alert('WebUSB not supported in this browser. Please use Google Chrome');
      $('#connect').prop('disabled', true);
      $('#connect').html('Not Supported');
      return;
    }

    // listen for form input changes and save them to the device
    $('#frm-config input').on('change', function() {
      var orientation = $('input[name=orientation]:checked', '#frm-config').val();
      var baro_calibration = $('input#seaPressureInput').val();
      var min_batt_v = $('input#minBattInput').val();
      var max_batt_v = $('input#maxBattInput').val();
      var metric_temp = $('#units-temp').prop('checked');
      var metric_alt = $('#units-alt').prop('checked');

      var usb_json = {
          'major_v' : 4,
          'minor_v' : 1,
          'screen_rot': orientation,
          'sea_pressure': parseFloat(baro_calibration),
          'metric_temp': metric_temp,
          'metric_alt': metric_alt,
          'min_batt_v': min_batt_v,
          'max_batt_v': max_batt_v,
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
          $('#armedTime').text(display(usb_parsed['armed_time']));
          $('#deviceId').text(usb_parsed['device_id']);
          $('#versionMajor').text(usb_parsed['major_v']);
          $('#versionMinor').text(usb_parsed['minor_v']);
          $('#orientation-lh').prop('checked', usb_parsed['screen_rot'] == 2);
          $('#orientation-rh').prop('checked', usb_parsed['screen_rot'] == 0);
          $('#units-temp').prop('checked', usb_parsed['metric_temp']);
          $('#units-alt').prop('checked', usb_parsed['metric_alt']);
          $('#seaPressureInput').val(usb_parsed['sea_pressure']);
          $('#minBattInput').val(usb_parsed['min_batt_v']);
          $('#maxBattInput').val(usb_parsed['max_batt_v']);
          console.log('received', usb_input);
        };
        port.onReceiveError = error => {
          console.error(error);
        };
      }, error => {
        displayError(error)
      });
    }

    function displayError(error){
      console.log(error);
      statusDisplay.textContent = error.message;
    }

    function display (minutes) {
      const format = val => `0${Math.floor(val)}`.slice(-2)
      const hours = minutes / 60

      return [hours, minutes % 60].map(format).join(':')
    }

    connectButton.addEventListener('click', function() {
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

    function disconnect(){
      port.disconnect();
      $('#frm-config :input').prop('disabled', true);
      connectButton.textContent = 'Connect';
      statusDisplay.textContent = '';
      port = null;
    }

    function sendJSON(usb_json){
      port.send(new TextEncoder('utf-8').encode(JSON.stringify(usb_json)));
    }

  });
})();
