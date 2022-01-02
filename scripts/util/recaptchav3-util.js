'use strict';
// libraries

// modules
// const dateUtil = require('./date-util.js');
const httpsUtil = require('./https-util.js');

// constants
const recaptchav3Url = 'https://www.google.com/recaptcha/api/siteverify';

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
const ipFailMap = new Map();
/* eslint-enable no-unused-vars */

// functions
const init = (_config, _loggingUtil) => {
  if (_config === undefined) {
    throw Error('config is required.');
  }
  if (_loggingUtil === undefined) {
    throw Error('loggingUtil is required.');
  }
  config = _config;
  loggingUtil = _loggingUtil;
};

const deactivate = () => {
  config = undefined;
  loggingUtil = undefined;
};

const verify = async (token, ip) => {
  if (ipFailMap.has(ip)) {
    const retryTimeMs = ipFailMap.get(ip);
    const retrySeconds = Math.ceil((retryTimeMs - Date.now()) / 1000);
    if (retrySeconds > 0) {
      const tokenValidationInfo = {};
      tokenValidationInfo.valid = false;
      tokenValidationInfo.message = `retry in ${retrySeconds} seconds.`;
      return tokenValidationInfo;
    } else {
      ipFailMap.delete(ip);
    }
  }
  const formData = {};
  formData.secret = config.recaptchav3.secretKey;
  formData.response = token;
  formData.remoteip = ip;
  // loggingUtil.log('recaptchav3', 'verify', 'formData', formData);
  const response = await httpsUtil.sendRequest(recaptchav3Url, 'POST', formData, 'form');
  const tokenValidationInfo = {};
  if (!response.success) {
    ipFailMap.set(ip, Date.now() + config.recaptchav3.recaptchaRetryTimeMs);
  }
  // if (!response.success) {
  // loggingUtil.log(dateUtil.getDate(), 'recaptchav3', 'verify', 'response', response);
  // }
  tokenValidationInfo.valid = response.success;
  tokenValidationInfo.message = '';
  if (response.score !== undefined) {
    tokenValidationInfo.message += ` score ${response.score}`;
  }
  if (response['error-codes'] !== undefined) {
    tokenValidationInfo.message += ` errors ${JSON.stringify(response['error-codes'])}`;
  }
  tokenValidationInfo.message = tokenValidationInfo.message.trim();
  return tokenValidationInfo;
};

exports.init = init;
exports.deactivate = deactivate;
exports.verify = verify;
