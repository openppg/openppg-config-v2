
function isUsbSupported(){
  // check if WebUSB is supported
  if ('usb' in navigator) {
    console.log('has WebUSB support');
    return true;
  } else {
    alert('WebUSB not supported: Please use Chrome on desktop or Android');
    $('#connect').prop('disabled', true);
    $('#connect').html('Not Supported');
    return false;
  }
}

