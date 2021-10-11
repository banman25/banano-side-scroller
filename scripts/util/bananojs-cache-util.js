'use strict';
// libraries
const fs = require('fs');
const path = require('path');
const bananojs = require('@bananocoin/bananojs');
const awaitSemaphore = require('await-semaphore');
// modules
const dateUtil = require('./date-util.js');

// constants
const ACCOUNT_STR = '^ban_[13456789abcdefghijkmnopqrstuwxyz]{0,64}$';
const accountRegExp = new RegExp(ACCOUNT_STR);

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
let mutex;
/* eslint-enable no-unused-vars */

// functions
const init = (_config, _loggingUtil, _seed, _entropyList) => {
  /* istanbul ignore if */
  if (_config === undefined) {
    throw new Error('config is required.');
  }
  /* istanbul ignore if */
  if (_loggingUtil === undefined) {
    throw new Error('loggingUtil is required.');
  };
  config = _config;
  loggingUtil = _loggingUtil;
  mutex = new awaitSemaphore.Mutex();

  if (!fs.existsSync(config.bananojsCacheDataDir)) {
    fs.mkdirSync(config.bananojsCacheDataDir, {recursive: true});
  }
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  /* eslint-enable no-unused-vars */
};

const getAccountFile = (account) => {
  if (account === undefined) {
    throw new Error('account is required.');
  };
  return path.join(config.bananojsCacheDataDir, account);
};

const testRegExp = (regExp, regExpStr, key, value) => {
  isValid = regExp.test(value);
  if (!isValid) {
    invalidReason = `invalid '${key}' in body '${value}' does not match pattern '${regExpStr}'`;
  }
};

const getScore = async (account) => {
  if (accountRegExp.test(account)) {
    const mutexRelease = await mutex.acquire();
    try {
      const accountData = getAccountData(account);
      return accountData.score;
    } finally {
      mutexRelease();
    }
  }
};

const incrementScore = async (account, score) => {
  if (accountRegExp.test(account)) {
    const mutexRelease = await mutex.acquire();
    try {
      const accountData = getAccountData(account);
      accountData.score = (BigInt(accountData.score) + BigInt(score)).toString();
      saveAccountData(account, accountData);
    } finally {
      mutexRelease();
    }
  }
};

const saveAccountData = (account, data) => {
  const accountFile = getAccountFile(account);
  const accountFilePtr = fs.openSync(accountFile, 'w');
  fs.writeSync(accountFilePtr, JSON.stringify(data));
  fs.closeSync(accountFilePtr);
};

const getAccountData = (account) => {
  const accountFile = getAccountFile(account);
  if (!fs.existsSync(accountFile)) {
    saveAccountData(account, {'score': '0'});
  }
  const data = fs.readFileSync(accountFile, 'UTF-8');
  return JSON.parse(data);
};

const getTotalAccountCount = () => {
  if (fs.existsSync(config.bananojsCacheDataDir)) {
    return fs.readdirSync(config.bananojsCacheDataDir).length;
  } else {
    return 0;
  }
};

const getActiveAccountCount = () => {
  let count = 0;
  if (fs.existsSync(config.bananojsCacheDataDir)) {
    fs.readdirSync(config.bananojsCacheDataDir).forEach((file) => {
      const fileNm = path.join(config.bananojsCacheDataDir, file);
      const {mtimeMs} = fs.statSync(fileNm);
      const activeTimeMs = mtimeMs;
      const activeTimeCutoffMs = Date.now() - config.activeTimeMs;
      // loggingUtil.log(dateUtil.getDate(), 'file', file, 'activeTimeMs', activeTimeMs, 'activeTimeCutoffMs', activeTimeCutoffMs, 'diff', (activeTimeCutoffMs - activeTimeMs));
      if (activeTimeMs > activeTimeCutoffMs) {
        count++;
      }
    });
  }
  return count;
};

module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.incrementScore = incrementScore;
module.exports.getScore = getScore;
module.exports.getTotalAccountCount = getTotalAccountCount;
module.exports.getActiveAccountCount = getActiveAccountCount;
