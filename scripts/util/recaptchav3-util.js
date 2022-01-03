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
const statusCountMap = new Map();
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
  ipFailMap.clear();
  statusCountMap.clear();
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

  let status = '';
  if (response.success) {
    status += 'success';
  } else {
    status += 'failure';
  }
  if (response.score !== undefined) {
    status += ` score ${response.score}`;
  } else {
    status += ` no score`;
  }
  if (statusCountMap.has(status)) {
    const statusCount = statusCountMap.get(status);
    statusCountMap.set(status, statusCount+1);
  } else {
    statusCountMap.set(status, 1);
  }

  return tokenValidationInfo;
};

const getStatusCountMapArray = () => {
  const array = [];
  const entries = [...statusCountMap.entries()];
  entries.forEach((entry) => {
    array.push({status: entry[0], count: entry[1]});
  });
  return array;
};

exports.init = init;
exports.deactivate = deactivate;
exports.verify = verify;
exports.getStatusCountMapArray = getStatusCountMapArray;
