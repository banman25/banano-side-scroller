// libraries
const crypto = require('crypto');

// modules
// constants
// variables
// functions
const shuffle = (array) => {
  if (array == undefined) {
    throw Error('array is required.');
  }
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const getRandom = (min, max) => {
  return Math.random() * (max - min) + min;
};

const getRandomInt = (min, max) => {
  return Math.floor(getRandom(Math.floor(min), Math.floor(max)));
};

const getRandomArrayElt = (array) => {
  const ix = getRandomInt(0, array.length);
  return array[ix];
};

const getRandomHex32 = () => {
  return crypto.randomBytes(32).toString('hex');
};

const getRandomColor = () => {
  return '#' + crypto.randomBytes(3).toString('hex');
};

exports.getRandomArrayElt = getRandomArrayElt;
exports.shuffle = shuffle;
exports.getRandom = getRandom;
exports.getRandomInt = getRandomInt;
exports.getRandomHex32 = getRandomHex32;
exports.getRandomColor = getRandomColor;
