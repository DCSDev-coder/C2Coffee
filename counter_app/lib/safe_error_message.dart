class SafeErrorMessage {
  const SafeErrorMessage._();

  static String fromStatus(int statusCode, String fallback) {
    switch (statusCode) {
      case 400:
        return 'Please check the information and try again.';
      case 401:
        return 'This device session has expired. Please activate the device again.';
      case 403:
        return 'This action is not permitted for this device.';
      case 404:
        return 'The requested service is unavailable.';
      case 408:
      case 504:
        return 'The request timed out. Please try again.';
      case 409:
        return 'This request has already been processed. Please check the current status.';
      case 429:
        return 'Too many attempts. Please wait and try again.';
      default:
        return fallback;
    }
  }
}
