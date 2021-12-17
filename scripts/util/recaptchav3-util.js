'use strict';
// libraries

// modules
const dateUtil = require('./date-util.js');
const httpsUtil = require('./https-util.js');

// constants
const recaptchav3Url = 'https://www.google.com/recaptcha/api/siteverify';

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
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
  const formData = {};
  formData.secret = config.recaptchav3.secretKey;
  formData.response = token;
  formData.remoteip = ip;
  // loggingUtil.log('recaptchav3', 'verify', 'formData', formData);
  const response = await httpsUtil.sendRequest(recaptchav3Url, 'POST', formData, 'form');
  const tokenValidationInfo = {};
  if (!response.success) {
    loggingUtil.log(dateUtil.getDate(), 'recaptchav3', 'verify', 'response', response);
  }
  tokenValidationInfo.valid = response.success;
  tokenValidationInfo.message = `score ${response.score}`;
  return tokenValidationInfo;
};

exports.init = init;
exports.deactivate = deactivate;
exports.verify = verify;
