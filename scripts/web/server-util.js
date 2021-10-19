'use strict';
// libraries
const fs = require('fs');
const path = require('path');
const http = require('http');
// const https = require('https');
// const cors = require('cors');
const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

// modules
const randomUtil = require('../util/random-util.js');
const dateUtil = require('../util/date-util.js');
const ipUtil = require('../util/ip-util.js');
const bmCaptchaUtil = require('../util/bm-captcha-util.js');
const bananojsCacheUtil = require('../util/bananojs-cache-util.js');
const paymentUtil = require('../util/payment-util.js');

// constants
const REWARD_IX = 2;
const PENALTY_IX = 1;
let chunksById;
const chunkIds = [];

// variables
let config;
let loggingUtil;
let instance;
let closeProgramFn;
const tempDataByAccount = new Map();

// functions
const init = async (_config, _loggingUtil) => {
  if (_config === undefined) {
    throw Error('config is required.');
  }
  if (_loggingUtil === undefined) {
    throw Error('loggingUtil is required.');
  }
  config = _config;
  loggingUtil = _loggingUtil;

  /* istanbul ignore if */
  if (config.cookieSecret.length == 0) {
    throw Error('config.cookieSecret is required.');
  }

  /* istanbul ignore if */
  if (config.walletSeed.length == 0) {
    throw Error('config.walletSeed is required.');
  }

  /* istanbul ignore if */
  if (config.walletSeedIx.length == 0) {
    throw Error('config.walletSeedIx is required.');
  }

  /* istanbul ignore if */
  if (config.walletRepresentative.length == 0) {
    throw Error('config.walletRepresentative is required.');
  }

  /* istanbul ignore if */
  if (config.bananodeApiUrl.length == 0) {
    throw Error('config.bananodeApiUrl is required.');
  }

  for (let dataPackIx = 0; dataPackIx < config.dataPacks.length; dataPackIx++) {
    const dataPack = config.dataPacks[dataPackIx];
    if (dataPack.url.endsWith('/')) {
      dataPack.url = dataPack.url.substring(0, dataPack.url.length-1);
    }
  }

  loadChunks();
  await initWebServer();
};

const loadChunks = () => {
  chunksById = {};
  chunkIds.length = 0;
  const json =config.chunks;
  json.forEach((elt) => {
    chunkIds.push(elt.id);
    chunksById[elt.id] = elt.chunk;
  });
};

const deactivate = async () => {
  config = undefined;
  loggingUtil = undefined;
  closeProgramFn = undefined;
  instance.close();
};

const getTempData = (account, ip) => {
  if (account === undefined) {
    throw Error('account is required.');
  }
  if (ip === undefined) {
    throw Error('ip is required.');
  }
  if (!tempDataByAccount.has(account)) {
    const accountData = {};
    accountData.tempScoreByIp = new Map();
    tempDataByAccount.set(account, accountData);
  }
  const accountData = tempDataByAccount.get(account);
  if (!accountData.tempScoreByIp.has(ip)) {
    const ipData = {};
    ipData.score = 0;
    // console.log(dateUtil.getDate(), 'getTempData', 'account', account, 'ip', ip, 'ipData', ipData);
    accountData.tempScoreByIp.set(ip, ipData);
  }
  const retval = accountData.tempScoreByIp.get(ip);
  if (retval == undefined) {
    console.log(dateUtil.getDate(), 'getTempData', 'account', account, 'ip', ip, 'retval', retval);
  }
  return retval;
};

const initWebServer = async () => {
  const app = express();

  app.engine('.hbs', exphbs({
    extname: '.hbs',
    defaultLayout: 'main',
  }));
  app.set('view engine', '.hbs');

  app.use(express.static('static-html'));
  app.use(express.urlencoded({
    limit: '50mb',
    extended: true,
  }));
  app.use(bodyParser.json({
    limit: '50mb',
    extended: true,
  }));
  app.use((err, req, res, next) => {
    if (err) {
      loggingUtil.log(dateUtil.getDate(), 'error', err.message, err.body);
      res.send('');
    } else {
      next();
    }
  });

  app.use(cookieParser(config.cookieSecret));

  app.get('/', async (req, res) => {
    res.redirect(302, '/side-scroller');
  });

  app.post('/', async (req, res) => {
    res.redirect(302, '/');
  });

  app.get('/side-scroller', async (req, res) => {
    const data = {};
    data.data_packs = [];

    const selectedDataPack = getDataPackCookie(req);
    for (let dataPackIx = 0; dataPackIx < config.dataPacks.length; dataPackIx++) {
      const dataPack = config.dataPacks[dataPackIx];
      const elt = {};
      elt.name = dataPack.name;
      if (elt.name == selectedDataPack) {
        elt.selected = 'selected';
      } else {
        elt.selected = '';
      }
      data.data_packs.push(elt);
    }
    res.render('side-scroller', data);
  });

  app.get('/level-designer', async (req, res) => {
    const data = {};
    res.render('level-designer', data);
  });

  app.get('/bm-captcha-register', async (req, res) => {
    bmCaptchaUtil.register(req, res);
  });

  app.post('/bm-captcha-register', async (req, res) => {
    bmCaptchaUtil.register(req, res);
  });

  app.post('/bm-captcha-verify', async (req, res) => {
    const ip = ipUtil.getIp(req);
    const callback = async (account, success) => {
      const tempData = getTempData(account, ip);
      if (success) {
        if (!await paymentUtil.isSessionClosed()) {
          await bananojsCacheUtil.incrementScore(account, tempData.score);
        }
      }
      tempData.score = 0;
    };
    bmCaptchaUtil.verify(req, res, callback);
  });

  app.post('/bm-captcha-request', async (req, res) => {
    bmCaptchaUtil.captcha(req, res);
  });

  config.assets.forEach((asset) => {
    if (asset.file === undefined) {
      asset.file = asset.img;
    }
    app.get(`/${asset.dir}/${asset.img}`, async (req, res) => {
      const dataPackName = getDataPackCookie(req);
      for (let dataPackIx = 0; dataPackIx < config.dataPacks.length; dataPackIx++) {
        const dataPack = config.dataPacks[dataPackIx];
        if (dataPack.name == dataPackName) {
          const url = `${dataPack.url}/${asset.dir}/${asset.file}`;
          // console.log('dataPackName', dataPackName, url);
          res.redirect(302, url);
          return;
        }
      }
      res.status(404);
      res.type('text/plain;charset=UTF-8').send('');
    });
  });

  app.post('/data_pack', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.body.data_pack) {
      const newDataPack = req.body.data_pack;
      for (let dataPackIx = 0; dataPackIx < config.dataPacks.length; dataPackIx++) {
        const dataPack = config.dataPacks[dataPackIx];
        if (dataPack.name == newDataPack) {
          setDataPackCookie(res, dataPack.name);
          const data = {
            success: true,
            message: 'set data_pack to:' + dataPack.name,
          };
          res.end(JSON.stringify(data));
          return;
        }
      }
      const data = {
        success: false,
        message: 'unknown data_pack name:' + newDataPack,
      };
      res.end(JSON.stringify(data));
    } else {
      const data = {
        success: false,
        message: 'no data_pack',
      };
      res.end(JSON.stringify(data));
    }
  });

  app.get('/increment_score', async (req, res) => {
    const ip = ipUtil.getIp(req);
    const account = req.query.account;
    const id = parseInt(req.query.id, 10);
    const ix = parseInt(req.query.ix, 10);
    const colIx = parseInt(req.query.col_ix, 10);
    const rowIx = parseInt(req.query.row_ix, 10);

    const sessionInfo = await paymentUtil.getSessionInfo();

    const data = {};
    data.session_description = sessionInfo.description;
    data.success = false;
    data.session_open = true;
    data.message = 'unknown error';
    if (account == undefined) {
      data.success = false;
      data.message = 'account missing from request';
    } else if (sessionInfo.closed) {
      data.success = false;
      data.session_open = false;
      data.message = 'session closed';
    } else {
      const tempData = getTempData(account, ip);
      // console.log(dateUtil.getDate(), 'increment_score', 'account', account, 'ix', ix, 'id', id, 'colIx', colIx, 'rowIx', rowIx, 'tempData', tempData);
      if (ix > tempData.chunk_ix) {
        tempData.chunk_ix = ix;
        tempData.prev_col_ix = 0;
      }

      if (tempData.chunk_ix != ix) {
        data.message = `client chunk index '${ix}' is not same as server chunk index '${tempData.chunk_ix}'`;
      } else {
        const serverChunkId = tempData.chunk_ids[ix];
        if (serverChunkId != id) {
          data.message = `client chunk id '${id}' is not same as server chunk id '${serverChunkId}'`;
        } else {
          if (colIx > tempData.prev_col_ix) {
            tempData.prev_col_ix = colIx;
          }
          /**
           * allow both prev_col_ix and prev_col_ix-1 because it's possible to
           * jump between two rewards.
           */
          if ((colIx == tempData.prev_col_ix) || (colIx == tempData.prev_col_ix-1)) {
            if (chunksById[id] !== undefined) {
              const chunk = chunksById[id];
              // console.log('increment_score', 'chunk', chunk);
              if (chunk[colIx] !== undefined) {
                const col = chunk[colIx];
                // console.log('increment_score', 'col', col);
                const value = col[rowIx];
                switch (value) {
                  case REWARD_IX:
                    // console.log('increment_score', 'accountData.score', accountData.score);
                    const rewardKey = `chunk:${ix};col:${colIx};row:${rowIx}`;
                    if (tempData.reward_set.has(rewardKey)) {
                      data.message = `in chunk '${ix}', reward key '${rewardKey}' was already claimed.'`;
                    } else {
                      tempData.reward_set.add(rewardKey);
                      tempData.score++;
                      data.success = true;
                      data.message = 'reward';
                    }
                    break;
                  case PENALTY_IX:
                  // console.log('increment_score', 'penalty', 'tempData.score', tempData.score);
                    tempData.score = 0;
                    data.success = true;
                    data.message = 'penalty';
                    break;
                  default:
                    data.message = `in chunk '${ix}', client value '${value}' is not a penalty '${PENALTY_IX}' or a reward '${REWARD_IX}'`;
                }
              } else {
                data.message = `in chunk '${ix}', client col_ix '${colIx}' not found in server chunk of length ${chunk.length}`;
              }
            } else {
              data.message = `in chunk '${ix}', client chunk_id '${id}' not found in server chunk_ids ${Object.keys(chunksById)}`;
            }
          } else {
            data.message = `in chunk '${ix}', client col_ix '${colIx}' is not server col_ix '${tempData.prev_col_ix}'`;
          }
        }
      }
    }

    if (!data.success) {
      console.log(dateUtil.getDate(), 'increment_score', 'error', data.message, JSON.stringify(req.query));
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  });

  app.get('/score', async (req, res) => {
    const ip = ipUtil.getIp(req);
    const account = req.query.account;
    const data = {};
    data.success = false;
    data.message = 'unknown error';
    if (account == undefined) {
      data.success = false;
      data.message = 'account missing from request';
    } else {
      data.success = true;
      data.message = 'score';
      const tempData = getTempData(account, ip);
      data.tempScore = tempData.score;
      data.finalScore = await bananojsCacheUtil.getScore(account);
    }

    if (!data.success) {
      console.log(dateUtil.getDate(), 'score', 'error', data.message, JSON.stringify(req.query));
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  });

  app.get('/board', async (req, res) => {
    const ip = ipUtil.getIp(req);
    const account = req.query.account;
    const data = {};
    data.success = false;
    data.message = 'unknown error';
    if (account == undefined) {
      data.success = false;
      data.message = 'account missing from request';
    } else {
      data.success = true;
      data.message = 'board';
      data.chunk_ids = [];
      for (let x = 0; x < config.numberOfChunksPerBoard; x++) {
        data.chunk_ids.push(randomUtil.getRandomArrayElt(chunkIds));
      }
      const tempData = getTempData(account, ip);
      tempData.chunk_ids = data.chunk_ids;
      tempData.chunk_ix = 0;
      tempData.prev_col_ix = -1;
      tempData.reward_set = new Set();
      // console.log(dateUtil.getDate(), 'board', 'account', account, 'tempData', tempData);
    }

    if (!data.success) {
      console.log(dateUtil.getDate(), 'board', 'error', data.message, JSON.stringify(req.query));
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  });


  app.get('/chunk', async (req, res) => {
    const id = req.query.id;
    const data = {};
    if (chunksById[id] != undefined) {
      data.chunk = chunksById[id];
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  });

  app.get('/js-lib/bananocoin-bananojs.js', async (req, res) => {
    const filePath = path.join('node_modules', '@bananocoin', 'bananojs', 'dist', 'bananocoin-bananojs.js');
    const data = fs.readFileSync(filePath);
    res.type('application/javascript').send(data);
  });

  app.get('/favicon.ico', async (req, res) => {
    res.redirect(302, '/favicon-16x16.png');
  });

  app.post('/favicon.ico', async (req, res) => {
    res.redirect(302, '/favicon.ico');
  });

  app.use((req, res, next) => {
    res.status(404);
    res.type('text/plain;charset=UTF-8').send('');
  });

  const server = http.createServer(app);

  instance = server.listen(config.web.port, (err) => {
    if (err) {
      loggingUtil.error(dateUtil.getDate(), 'ERROR', err);
    }
    loggingUtil.log(dateUtil.getDate(), 'listening on PORT', config.web.port);
  });

  const io = require('socket.io')(server);
  io.on('connection', (socket) => {
    socket.on('npmStop', () => {
      socket.emit('npmStopAck');
      socket.disconnect(true);
      closeProgramFn();
    });
  });
};

const setCloseProgramFunction = (fn) => {
  closeProgramFn = fn;
};

const setDataPackCookie = (res, dataPack) => {
  res.cookie('data_pack', dataPack, {signed: true});
};

const getDataPackCookie = (req) => {
  let dataPack;
  if (req.signedCookies.data_pack === undefined) {
    dataPack = config.defaultDataPack;
  } else {
    dataPack = req.signedCookies.data_pack;
  }
  return dataPack;
};

// exports
exports.init = init;
exports.deactivate = deactivate;
exports.setCloseProgramFunction = setCloseProgramFunction;
