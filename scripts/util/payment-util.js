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
const ZERO = BigInt(0);
const ONE_HUNDRED = BigInt(100);

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
let mutex;
let walletAccountBalanceDescription;
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

  walletAccountBalanceDescription = 'loading...';

  if (!fs.existsSync(config.sessionPayoutDataDir)) {
    fs.mkdirSync(config.sessionPayoutDataDir, {recursive: true});
  }
};

const deactivate = () => {
  config = undefined;
  loggingUtil = undefined;
  mutex = undefined;
};

const getBigIntMax = (...args) => {
  return args.reduce((m, e) => e > m ? e : m);
};

const msToTime = (duration) => {
  duration = Number(duration);
  const milliseconds = Math.floor((duration % 1000) / 100);
  let seconds = Math.floor((duration / 1000) % 60);
  let minutes = Math.floor((duration / (1000 * 60)) % 60);
  let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  hours = (hours < 10) ? '0' + hours : hours;
  minutes = (minutes < 10) ? '0' + minutes : minutes;
  seconds = (seconds < 10) ? '0' + seconds : seconds;

  return hours + ':' + minutes + ':' + seconds + '.' + milliseconds;
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
  const sessionInfo = await getSessionInfo();
  return sessionInfo.closed;
};

const getSessionInfo = async () => {
  const mutexRelease = await mutex.acquire();
  const sessionInfo = {};
  try {
    const sessionStartTime = getSessionStartTime();
    sessionInfo.start = sessionStartTime.toString();
    sessionInfo.balance_description = walletAccountBalanceDescription;
    if(config.sessionAutomaticPaymentFlag) {
      const sessionDuration = BigInt(config.sessionDurationMs);
      const currentTime = BigInt(Date.now());
      const currentDuration = currentTime - sessionStartTime;
      const remainingDuration = getBigIntMax(ZERO, sessionDuration-currentDuration);
      if (remainingDuration <= ZERO) {
        sessionInfo.closed = true;
      }
      sessionInfo.duration = sessionDuration.toString();
      sessionInfo.remaining = remainingDuration.toString();
      sessionInfo.remaining_description = msToTime(remainingDuration);
    } else {
      sessionInfo.duration = 'infinite';
      sessionInfo.remaining = 'infinite';
      sessionInfo.remaining_description = 'infinite';
    }
    sessionInfo.description = `Session prize:${sessionInfo.balance_description} time left:${sessionInfo.remaining_description}`;
  } finally {
    mutexRelease();
  }
  return sessionInfo;
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
  if (pendingList.length > 0) {
    loggingUtil.log(dateUtil.getDate(), 'account', account, 'pendingList.length', pendingList.length);
  }
  return pendingList;
};

const receiveWalletPending = async () => {
  await receivePending(config.walletRepresentative, config.walletSeed, config.walletSeedIx);
  walletAccountBalanceDescription = await getAccountBalanceDescription(config.walletSeed, config.walletSeedIx);
};

const getAccountBalanceDescription = async (seed, seedIx) => {
  const account = await bananojs.getBananoAccountFromSeed(seed, seedIx);
  const accountInfo = await bananojs.getAccountInfo(account, true);
  if (accountInfo == undefined) {
    return '';
  }
  if (accountInfo.balance == undefined) {
    return JSON.stringify(accountInfo);
  }
  const payoutBalance = getPayoutBalance(accountInfo);
  const balanceParts = await bananojs.getBananoPartsFromRaw(payoutBalance);
  const description = await bananojs.getBananoPartsDescription(balanceParts);
  return description;
};

const getPayoutBalance = (accountInfo) => {
  const balance = BigInt(accountInfo.balance);
  const sessionPayoutRatio = BigInt(parseFloat(config.sessionPayoutRatio)*100);
  const payoutBalance = (balance * sessionPayoutRatio) / ONE_HUNDRED;
  return payoutBalance;
};

const payEverybodyAndReopenSession = async () => {
  try {
    const scores = await bananojsCacheUtil.getAndClearAllScores();
    let maxScore = ZERO;
    for (let scoreIx = 0; scoreIx < scores.length; scoreIx++) {
      const scoreElt = scores[scoreIx];
      maxScore += BigInt(scoreElt.score);
    }

    loggingUtil.log(dateUtil.getDate(), 'payment', 'scores.length',
        scores.length, 'maxScore', maxScore);

    if (maxScore > ZERO) {
      const account = await bananojs.getBananoAccountFromSeed(config.walletSeed, config.walletSeedIx);
      const accountInfo = await bananojs.getAccountInfo(account, true);
      if (accountInfo.balance !== undefined) {
        const payoutBalance = getPayoutBalance(accountInfo);
        const rawPerScore = payoutBalance / maxScore;

        loggingUtil.log(dateUtil.getDate(), 'payment', 'rawPerScore',
            rawPerScore, 'payoutBalance', payoutBalance);
        let previous = undefined;
        for (let scoreIx = 0; scoreIx < scores.length; scoreIx++) {
          try {
            const representative = config.walletRepresentative;
            const scoreElt = scores[scoreIx];
            const account = scoreElt.account;
            const score = scoreElt.score;
            const bananoRaw = BigInt(score) * rawPerScore;
            const balanceParts = await bananojs.getBananoPartsFromRaw(bananoRaw);
            const bananoDecimal = await bananojs.getBananoPartsAsDecimal(balanceParts);
            const seed = config.walletSeed;
            const seedIx = config.walletSeedIx;
            if (bananoRaw > ZERO) {
              const result = await bananojs.sendBananoWithdrawalFromSeed(seed,
                  seedIx, account, bananoDecimal, representative, previous);
              // add wait so you don't fork block yourself.
              loggingUtil.log(dateUtil.getDate(), 'payment', scoreIx, 'of',
                  scores.length, 'account', account, 'score', score, 'bananoDecimal',
                  bananoDecimal, 'bananoRaw', bananoRaw, 'result', result);
              previous = result;
            }
          } catch (error) {
            loggingUtil.log(dateUtil.getDate(), 'payment', 'error',
                error.message);
          }
        }
      }
    }
  } catch (error) {
    loggingUtil.log(dateUtil.getDate(), 'payment', 'error',
        error.message);
  } finally {
    setSessionStartTime();
  }
};

const getWalletAccount = async () => {
  const account = await bananojs.getBananoAccountFromSeed(config.walletSeed, config.walletSeedIx);
  return account;
};

exports.init = init;
exports.deactivate = deactivate;
exports.isSessionClosed = isSessionClosed;
exports.getSessionInfo = getSessionInfo;
exports.getSessionStartTime = getSessionStartTime;
exports.setSessionStartTime = setSessionStartTime;
exports.payEverybodyAndReopenSession = payEverybodyAndReopenSession;
exports.receiveWalletPending = receiveWalletPending;
exports.getWalletAccount = getWalletAccount;
