'use strict';
// libraries
const fs = require('fs');
const path = require('path');
const awaitSemaphore = require('await-semaphore');
const bananojs = require('@bananocoin/bananojs');

// modules
const dateUtil = require('./date-util.js');
const bananojsCacheUtil = require('./bananojs-cache-util.js');

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

  bananojs.setBananodeApiUrl(config.bananodeApiUrl);

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
  return path.join(config.sessionPayoutDataDir, 'sessionStartTime.txt');
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
    if (currentDuration >= sessionDuration) {
      return true;
    }
  } finally {
    mutexRelease();
  }
};

const receivePending = async (representative, seed, seedIx) => {
  const account = await bananojs.getBananoAccountFromSeed(seed, seedIx);
  const pendingList = [];
  let noPending = false;
  while (!noPending) {
    const pending = await bananojs.getAccountsPending([account], config.maxPendingBananos, true);
    if (pending!== undefined) {
      // loggingUtil.log(dateUtil.getDate(), 'account', account, 'pending', pending);
      if (pending.error) {
        noPending = true;
      } else {
        const pendingBlocks = pending.blocks[account];
        const hashes = [...Object.keys(pendingBlocks)];
        if (hashes.length !== 0) {
          const hash = hashes[0];
          const response = await bananojs.receiveBananoDepositsForSeed(seed, seedIx, representative, hash);
          pendingList.push(response);
        } else {
          noPending = true;
        }
      }
    }
  }
  loggingUtil.log(dateUtil.getDate(), 'account', account, 'pendingList.length', pendingList.length);
  return pendingList;
};

const receiveWalletPending = async () => {
  await receivePending(config.walletRepresentative, config.walletSeed, config.walletSeedIx);
};

const payEverybodyAndReopenSession = async () => {
  const scores = await bananojsCacheUtil.getAndClearAllScores();
  let maxScore = BigInt(0);
  for (let scoreIx = 0; scoreIx < scores.length; scoreIx++) {
    const scoreElt = scores[scoreIx];
    maxScore += BigInt(scoreElt.score);
  }

  loggingUtil.log(dateUtil.getDate(), 'payment', 'scores.length',
      scores.length, 'maxScore', maxScore);

  if (maxScore > BigInt(0)) {
    const account = await bananojs.getBananoAccountFromSeed(config.walletSeed, config.walletSeedIx);
    const accountInfo = await bananojs.getAccountInfo(account, true);
    const balance = BigInt(accountInfo.balance);
    const rawPerScore = balance / maxScore;

    for (let scoreIx = 0; scoreIx < scores.length; scoreIx++) {
      const scoreElt = scores[scoreIx];
      const account = scoreElt.account;
      const score = scoreElt.score;
      const bananoRaw = BigInt(score) * rawPerScore;
      const balanceParts = await bananojs.getBananoPartsFromRaw(bananoRaw);
      const bananoDecimal = await bananojs.getBananoPartsAsDecimal(balanceParts);
      loggingUtil.log(dateUtil.getDate(), 'payment', 'account',
          account, 'score', score, 'bananoDecimal', bananoDecimal);
      await bananojs.sendBananoWithdrawalFromSeed(config.walletSeed, config.walletSeedIx, account, bananoDecimal);
    }
  }
  setSessionStartTime();
};

exports.init = init;
exports.deactivate = deactivate;
exports.isSessionClosed = isSessionClosed;
exports.getSessionStartTime = getSessionStartTime;
exports.setSessionStartTime = setSessionStartTime;
exports.payEverybodyAndReopenSession = payEverybodyAndReopenSession;
exports.receiveWalletPending = receiveWalletPending;
