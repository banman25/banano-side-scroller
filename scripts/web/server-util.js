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

// constants
const REWARD_IX = 2;
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
    throw new Error('config is required.');
  }
  if (_loggingUtil === undefined) {
    throw new Error('loggingUtil is required.');
  }
  config = _config;
  loggingUtil = _loggingUtil;

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
  if (!tempDataByAccount.has(account)) {
    const accountData = {};
    accountData.tempScoreByIp = new Map();
    if (!accountData.tempScoreByIp.has(ip)) {
      const ipData = {};
      ipData.score = 0;
      accountData.tempScoreByIp.set(ip, ipData);
    }
    tempDataByAccount.set(account, accountData);
  }
  return tempDataByAccount.get(account).tempScoreByIp.get(ip);
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
        await bananojsCacheUtil.incrementScore(account, tempData.score);
      }
      tempData.score = 0;
    };
    bmCaptchaUtil.verify(req, res, callback);
  });

  app.post('/bm-captcha-request', async (req, res) => {
    bmCaptchaUtil.captcha(req, res);
  });

  config.assets.forEach((asset) => {
    app.get(`/${asset.dir}/${asset.img}`, async (req, res) => {
      if (asset.file === undefined) {
        asset.file = asset.img;
      }
      const url = `${config.dataPackUrl}/static-html/${asset.dir}/${asset.file}`;
      res.redirect(302, url);
    });
  });

  app.get('/increment_score', async (req, res) => {
    /*
     * to do: check that the chunk id and colIx are to the right of the previous
     * captured reward.
     */

    const ip = ipUtil.getIp(req);
    const account = req.query.account;
    const tempData = getTempData(account, ip);
    const id = req.query.id;
    const colIx = req.query.col_ix;
    const rowIx = req.query.row_ix;
    // console.log('increment_score', 'account', account, 'id', id, 'colIx', colIx, 'rowIx', rowIx);
    if (chunksById[id] !== undefined) {
      const chunk = chunksById[id];
      // console.log('increment_score', 'chunk', chunk);
      if (chunk[colIx] !== undefined) {
        const col = chunk[colIx];
        // console.log('increment_score', 'col', col);
        if (col[rowIx] == REWARD_IX) {
          // console.log('increment_score', 'accountData.score', accountData.score);
          tempData.score++;
        }
      }
    }
    const data = {};
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  });

  app.get('/score', async (req, res) => {
    const ip = ipUtil.getIp(req);
    const account = req.query.account;
    const tempData = getTempData(account, ip);
    const data = {};
    data.tempScore = tempData.score;
    data.finalScore = await bananojsCacheUtil.getScore(account);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  });

  app.get('/board', async (req, res) => {
    const account = req.query.account;
    const data = {};
    data.chunk_ids = [];
    for (let x = 0; x < config.numberOfChunksPerBoard; x++) {
      data.chunk_ids.push(randomUtil.getRandomArrayElt(chunkIds));
    }
    const tempData = getTempData(account);
    tempData.chunk_ids = data.chunk_ids;
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

// exports
exports.init = init;
exports.deactivate = deactivate;
exports.setCloseProgramFunction = setCloseProgramFunction;
