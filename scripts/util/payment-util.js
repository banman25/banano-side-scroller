'use strict';
// libraries
const fs = require('fs');
const path = require('path');
const awaitSemaphore = require('await-semaphore');

// modules

// constants

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
let mutex;
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
  mutex = new awaitSemaphore.Mutex();

  if (!fs.existsSync(config.sessionPayoutDataDir)) {
    fs.mkdirSync(config.sessionPayoutDataDir, {recursive: true});
  }
};

const deactivate = () => {
  config = undefined;
  loggingUtil = undefined;
  mutex = undefined;
};

const getSessionStartTimeFile = () => {
  return path.join(config.bananojsCacheDataDir, 'sessionStartTime.txt');
};

const setSessionStartTime = () => {
  const file = getSessionStartTimeFile();
  const filePtr = fs.openSync(file, 'w');
  fs.writeSync(filePtr, Date.now().toString());
  fs.closeSync(filePtr);
};

const getSessionStartTime = () => {
  const file = getSessionStartTimeFile();
  if (!fs.existsSync(file)) {
    setSessionStartTime();
  }
  const data = fs.readFileSync(file, 'UTF-8');
  return BigInt(data);
};

const isSessionClosed = async () => {
    const mutexRelease = await mutex.acquire();
    try {
      const sessionStartTime = getSessionStartTime();
      const sessionDuration = BigInt(config.sessionDurationMs);
      const currentTime = BigInt(Date.now());
      const currentDuration = currentTime - sessionStartTime;
      if(currentDuration >= sessionDuration) {
        return true;
      }
    } finally {
      mutexRelease();
    }
}

exports.init = init;
exports.deactivate = deactivate;
exports.isSessionClosed = isSessionClosed;
exports.getSessionStartTime = getSessionStartTime;
exports.setSessionStartTime = setSessionStartTime;
