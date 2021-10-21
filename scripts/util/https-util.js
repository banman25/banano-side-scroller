'use strict';
// libraries
const https = require('https');
const http = require('http');

// modules

// constants

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

const sendRequest = async (url, method, formData) => {
  if (url == undefined) {
    throw Error(`'url' is a required parameter.`);
  }
  if (method == undefined) {
    throw Error(`'method' is a required parameter.`);
  }
  return new Promise((resolve) => {
    const apiUrl = new URL(url);
    const body = JSON.stringify(formData);
    // console.log('sendRequest url', url);

    let protocol;
    switch (apiUrl.protocol) {
      case 'http:':
        protocol = http;
        break;
      case 'https:':
        protocol = https;
        break;
      default:
        throw Error(`unknown protocol:'${apiUrl.protocol}' in url '${apiUrl.protocol}'`);
    }

    const options = {
      method: method,
      timeout: 30000,
    };

    if (formData !== undefined) {
      options.headers = {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      };
    }

    const req = protocol.request(apiUrl, options, (res) => {
      // console.log(`statusCode: ${res.statusCode}`);
      let chunks = '';
      res.on('data', (chunk) => {
        chunks += chunk;
      });

      res.on('end', () => {
        if (chunks.length == 0) {
          resolve(undefined);
        } else {
          const json = JSON.parse(chunks);
          resolve(json);
        }
      });
    });

    req.on('error', (error) => {
      console.log('sendRequest error', error, body);
    });

    if (formData !== undefined) {
      req.write(body);
    }
    req.end();
  });
};
exports.init = init;
exports.deactivate = deactivate;
exports.sendRequest = sendRequest;
