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
const bmCaptchaUtil = require('../util/bm-captcha-util.js');

// constants
let chunksById;
const chunkIds = [];

// variables
let config;
let loggingUtil;
let instance;
let closeProgramFn;
let score = 0;

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
    const callback = (success) => {
      if (!success) {
        score = 0;
      }
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
      const filePath = path.join('data', 'static-html', asset.dir, asset.file);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        res.type(asset.type).send(data);
      } else {
        let dummyData = '<svg id="emoji" width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">';
        dummyData += '<g>';
        dummyData += '<rect x="0" y="0" width="100" height="100" fill="none" stroke="black" stroke-linecap="round" stroke-linejoin="round" stroke-width="1">';
        dummyData += '</rect>';
        dummyData += `<text x="50" y="40" font-family="impact" font-size="12" stroke="cyan" fill="black" pointer-events="none" text-anchor="middle">`;
        dummyData += asset.dir;
        dummyData += '</text>';
        dummyData += `<text x="50" y="60" font-family="impact" font-size="12" stroke="cyan" fill="black" pointer-events="none" text-anchor="middle">`;
        dummyData += asset.img;
        dummyData += '</text>';
        dummyData += '</g>';
        dummyData += '</svg>';
        const dummyDataType = 'image/svg+xml';
        res.type(dummyDataType).send(dummyData);
      }
    });
  });

  app.get('/increment_score', async (req, res) => {
    score++;
    const data = {};
    data.score = score;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  });

  app.get('/score', async (req, res) => {
    const data = {};
    data.score = score;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  });

  app.get('/board', async (req, res) => {
    const data = {};
    data.chunk_ids = [];
    for (let x = 0; x < config.numberOfChunksPerBoard; x++) {
      data.chunk_ids.push(randomUtil.getRandomArrayElt(chunkIds));
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
