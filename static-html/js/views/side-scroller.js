const BACKGROUND_WIDTH = 1000;
const BACKGROUND_HEIGHT = 700;
const ASSET_INTERSECT_HEIGHT = 10;
const ASSET_SIZE = 75;
const MOVE_DX = 25;
const OBSTACLE_MAX_Y = BACKGROUND_HEIGHT - ASSET_SIZE;
const FOREGROUND_MAX_Y = BACKGROUND_HEIGHT - (ASSET_SIZE*2);
const BACKGROUND_IMAGE_WIDTH = 700;
const FOREGROUND_DY = 15;
const MOVE_X = 40;
const MOVE_Y = 200;

const INTERVAL = 100;

const BURN_ACCOUNT = 'ban_1uo1cano1bot1a1pha1616161616161616161616161616161616p3s5tifp';

const MONKEY_HREF = 'monkey/monkey';

const REWARD_HREF = 'rewards/banana';

const PENALTY_HREF = 'ground/water';

const STATIC_BACKGROUND_HREF = 'background/static-background';

const MOVING_BACKGROUND_HREF = 'background/moving-background';

const BACKGROUND_OBJECT_HREFS = [
  'background/tipbot',
  'background/donations',
];

const assetsHrefs = [
  'ground/ground',
  PENALTY_HREF,
  REWARD_HREF,
];

let score = 'loading...';
let remaining = 0;
let captchaDisplayed = false;
let boardLoaded = false;
let boardLoading = false;
const captchaDisplayCooldown = 0;

const onLoad = () => {
  loadAccount();
  const mainElt = document.querySelector('#side_scroller');
  clear(mainElt);
  bmcaptcha.init('#side_scroller', captchaClicked);

  const svgElt = addChildSvgElement(mainElt, 'svg', {
    'width': BACKGROUND_WIDTH,
    'height': BACKGROUND_HEIGHT,
    'stroke': 'black',
    'stroke-width': '2',
    'style': 'background-color:darkgray',
    'id': 'game',
  });
  addChildSvgElement(svgElt, 'image', {
    'y': '0',
    'x': '0',
    'width': BACKGROUND_WIDTH,
    'height': BACKGROUND_HEIGHT,
    'fill': 'none',
    'stroke': 'none',
    'class': 'background',
    'data_dx': 0,
    'href': STATIC_BACKGROUND_HREF,
  });

  for (let x = -BACKGROUND_IMAGE_WIDTH; x <= BACKGROUND_WIDTH; x += BACKGROUND_IMAGE_WIDTH) {
    addChildSvgElement(svgElt, 'image', {
      'y': '0',
      'x': x,
      'width': BACKGROUND_WIDTH,
      'height': BACKGROUND_HEIGHT,
      'fill': 'none',
      'stroke': 'none',
      'class': 'background',
      'data_dx': 10,
      'href': MOVING_BACKGROUND_HREF,
    });
  }
  addChildSvgElement(svgElt, 'image', {
    'y': FOREGROUND_MAX_Y-ASSET_SIZE,
    'x': ASSET_SIZE,
    'width': ASSET_SIZE,
    'height': ASSET_SIZE*2,
    'fill': 'none',
    'stroke': 'none',
    'class': 'background',
    'data_dx': 10,
    'href': BACKGROUND_OBJECT_HREFS[0],
  });

  addChildSvgElement(svgElt, 'image', {
    'y': FOREGROUND_MAX_Y-ASSET_SIZE,
    'x': (BACKGROUND_IMAGE_WIDTH/2)+ASSET_SIZE,
    'width': ASSET_SIZE,
    'height': ASSET_SIZE*2,
    'fill': 'none',
    'stroke': 'none',
    'class': 'background',
    'data_dx': 10,
    'href': BACKGROUND_OBJECT_HREFS[1],
  });

  const groupSvgElt = addChildSvgElement(svgElt, 'g');

  addChildSvgElement(svgElt, 'image', {
    'y': FOREGROUND_MAX_Y,
    'x': ASSET_SIZE,
    'width': ASSET_SIZE,
    'height': ASSET_SIZE,
    'fill': 'red',
    'stroke': 'none',
    'class': 'foreground',
    'href': MONKEY_HREF,
  });

  setInterval(() => {
    if (!captchaDisplayed) {
      if (boardLoaded) {
        remaining--;
        if (remaining == 0) {
          showCaptcha();
          loadBoard(groupSvgElt);
        } else {
          moveBackground();
          moveObstacle();
          moveReward();
          movePenalty();
          moveForegroundDown();
          updateScore();
        }
      } else {
        loadBoard(groupSvgElt);
      }
    }
  }, INTERVAL);
};

const loadAccount = () => {
  const accountElt = document.querySelector('#account');
  if (window.localStorage.account === undefined) {
    window.localStorage.account = BURN_ACCOUNT;
  }
  accountElt.value = window.localStorage.account;
};

const saveAccount = () => {
  const accountElt = document.querySelector('#account');
  window.localStorage.account = accountElt.value;
};

const incrementScore = async (rewardElt) => {
  const id = rewardElt.dataset.chunkId;
  const col_ix = rewardElt.dataset.chunkColIx;
  const row_ix = rewardElt.dataset.chunkRowIx;
  const account = window.localStorage.account;
  const url = '/increment_score?' +
   `account=${account}&id=${id}&col_ix=${col_ix}&row_ix=${row_ix}`;
  // const response =
  await fetch(url, {
    method: 'GET',
  });
  // const responseJson = await response.json();
  await loadScore();
};

const loadScore = async () => {
  const account = window.localStorage.account;
  const url = `/score?account=${account}`;
  const response = await fetch(url, {
    method: 'GET',
  });
  const responseJson = await response.json();
  score = `${responseJson.tempScore}+${responseJson.finalScore}`;
  await updateScore();
};

const loadChunkIds = async () => {
  const response = await fetch('/board', {
    method: 'GET',
  });
  const responseJson = await response.json();
  return responseJson.chunk_ids;
};

const loadChunkById = async (id) => {
  const response = await fetch('/chunk?id=' + id, {
    method: 'GET',
  });
  const responseJson = await response.json();
  return responseJson.chunk;
};

const loadBoard = async (groupSvgElt) => {
  if (boardLoading) {
    return;
  }
  boardLoading = true;
  boardLoaded = false;
  clear(groupSvgElt);
  const chunkIds = await loadChunkIds();
  remaining = 0;
  let x = 0;
  for (let ix = 0; ix < chunkIds.length; ix++) {
    const id = chunkIds[ix];
    const chunk = await loadChunkById(id);
    remaining += chunk.length;

    for (let chunkColumnIx = 0; chunkColumnIx < chunk.length; chunkColumnIx++) {
      const chunkColumn = chunk[chunkColumnIx];
      let y = OBSTACLE_MAX_Y;
      for (let chunkRowIx = 0; chunkRowIx < chunkColumn.length; chunkRowIx++) {
        const assetId = chunkColumn[chunkRowIx];
        if (assetId >= 0) {
          if (assetId < assetsHrefs.length) {
            const href = assetsHrefs[assetId];
            let classNm = 'obstacle';
            if (href == REWARD_HREF) {
              classNm = 'reward';
            }
            if (href == PENALTY_HREF) {
              classNm = 'penalty';
            }
            addChildSvgElement(groupSvgElt, 'image', {
              'y': y,
              'x': x,
              'width': ASSET_SIZE,
              'height': ASSET_SIZE,
              'fill': 'none',
              'stroke': 'none',
              'class': classNm,
              'href': href,
              'data-chunk-id': id,
              'data-chunk-col-ix': chunkColumnIx,
              'data-chunk-row-ix': chunkRowIx,
            });
          } else {
            console.log('no asset:' + assetId);
          }
        }
        y -= ASSET_SIZE;
      }
      x += ASSET_SIZE;
    }
  }
  boardLoaded = true;
  boardLoading = false;
  await loadScore();
};

const moveUp = () => {
  // console.log('moveUp');
  moveForeground(0, -MOVE_Y);
  return false;
};

const moveLeft = () => {
  // console.log('moveLeft');
  moveForeground(-MOVE_X, 0);
  return false;
};

const moveRight = () => {
  // console.log('moveRight');
  moveForeground(MOVE_X, 0);
  return false;
};

const moveForeground = (x, y) => {
  if (captchaDisplayed) {
    displayErrorMessage('cannot move when captcha is displayed');
    return;
  }
  const foregroundElts = [...document.getElementsByClassName('foreground')];
  foregroundElts.forEach((foregroundElt) => {
    const eltX = parseFloat(get(foregroundElt, 'x'));
    const eltY = parseFloat(get(foregroundElt, 'y'));
    const eltWidth = parseFloat(get(foregroundElt, 'width'));
    if (eltX + x < 0) {
      set(foregroundElt, 'x', 0);
    } else if (eltX + x > BACKGROUND_WIDTH - eltWidth) {
      set(foregroundElt, 'x', BACKGROUND_WIDTH - eltWidth);
    } else {
      set(foregroundElt, 'x', eltX + x);
    }
    if (eltY + y < 0) {
      set(foregroundElt, 'y', 0);
    } else if (eltY + y > FOREGROUND_MAX_Y) {
      set(foregroundElt, 'y', FOREGROUND_MAX_Y);
    } else {
      set(foregroundElt, 'y', eltY + y);
    }
  });
};

const moveBackground = () => {
  if (captchaDisplayed) {
    return;
  }
  const backgroundElts = [...document.getElementsByClassName('background')];
  backgroundElts.forEach((backgroundElt) => {
    const dx = parseFloat(get(backgroundElt, 'data_dx'));
    const x = parseFloat(get(backgroundElt, 'x'));
    const eltWidth = parseFloat(get(backgroundElt, 'width'));
    if (x < -eltWidth) {
      set(backgroundElt, 'x', (x - dx) + BACKGROUND_IMAGE_WIDTH + eltWidth);
    } else {
      set(backgroundElt, 'x', x - dx);
    }
  });
};

const movePenalty = () => {
  if (captchaDisplayed) {
    return;
  }
  const obstacleElts = [...document.getElementsByClassName('penalty')];
  obstacleElts.forEach((obstacleElt) => {
    const x = parseFloat(get(obstacleElt, 'x'));
    const eltWidth = parseFloat(get(obstacleElt, 'width'));
    if (x >= -eltWidth) {
      // if elt is not offscreen, move it left.
      set(obstacleElt, 'x', x - MOVE_DX);
    } else {
      const parentElement = obstacleElt.parentElement;
      parentElement.removeChild(obstacleElt);
    }
  });
};

const moveObstacle = () => {
  if (captchaDisplayed) {
    return;
  }
  const obstacleElts = [...document.getElementsByClassName('obstacle')];
  obstacleElts.forEach((obstacleElt) => {
    const x = parseFloat(get(obstacleElt, 'x'));
    const eltWidth = parseFloat(get(obstacleElt, 'width'));
    if (x >= -eltWidth) {
      // if elt is not offscreen, move it left.
      set(obstacleElt, 'x', x - MOVE_DX);
    } else {
      const parentElement = obstacleElt.parentElement;
      parentElement.removeChild(obstacleElt);
    }
  });
};

const moveReward = () => {
  if (captchaDisplayed) {
    return;
  }
  const elts = [...document.getElementsByClassName('reward')];
  elts.forEach((elt) => {
    const x = parseFloat(get(elt, 'x'));
    const eltWidth = parseFloat(get(elt, 'width'));
    if (x >= -eltWidth) {
      // if elt is not offscreen, move it left.
      set(elt, 'x', x - MOVE_DX);
    } else {
      const parentElement = elt.parentElement;
      parentElement.removeChild(elt);
    }
  });
};

const moveForegroundDown = async () => {
  if (captchaDisplayed) {
    return;
  }

  const obstacleElts = [...document.getElementsByClassName('obstacle')];
  const penaltyElts = [...document.getElementsByClassName('penalty')];
  const foregroundElts = [...document.getElementsByClassName('foreground')];

  for (let foregroundEltIx = 0; foregroundEltIx < foregroundElts.length; foregroundEltIx++) {
    const foregroundElt = foregroundElts[foregroundEltIx];
    const y = parseFloat(get(foregroundElt, 'y'));
    let moveDown = true;
    obstacleElts.forEach((obstacleElt) => {
      if (intersect(obstacleElt, foregroundElt, ASSET_INTERSECT_HEIGHT, ASSET_INTERSECT_HEIGHT, ASSET_SIZE)) {
        moveDown = false;
      }
    });
    let showPenaltyCaptcha = false;
    for (let penaltyEltIx = 0; penaltyEltIx < penaltyElts.length; penaltyEltIx++) {
      const penaltyElt = penaltyElts[penaltyEltIx];
      if (intersect(penaltyElt, foregroundElt, ASSET_INTERSECT_HEIGHT, ASSET_INTERSECT_HEIGHT, ASSET_SIZE)) {
        moveDown = false;
        await incrementScore(penaltyElt);
        showPenaltyCaptcha = true;
      }
    }
    if (showPenaltyCaptcha) {
      showCaptcha();
    }

    if (y < FOREGROUND_MAX_Y) {
      if (moveDown) {
        set(foregroundElt, 'y', y + FOREGROUND_DY);
      }
    } else {
      set(foregroundElt, 'y', FOREGROUND_MAX_Y);
    }
  }
};

const intersect = (obstacleElt, foregroundElt, oH, fH, yOffset) => {
  if (oH == undefined) {
    oH = get(obstacleElt, 'height');
  }
  if (fH == undefined) {
    fH = get(foregroundElt, 'height');
  }
  if (yOffset == undefined) {
    yOffset = 0;
  }
  const oX = parseFloat(get(obstacleElt, 'x'));
  const oY = parseFloat(get(obstacleElt, 'y'));
  const oW = parseFloat(get(obstacleElt, 'width'));
  oH = parseFloat(oH);
  const fX = parseFloat(get(foregroundElt, 'x'));
  const fY = parseFloat(get(foregroundElt, 'y')) + parseFloat(yOffset);
  const fW = parseFloat(get(foregroundElt, 'width'));
  fH = parseFloat(fH);
  if (fX > oX + oW) {
    return false;
  }
  if (fX + fW < oX) {
    return false;
  }
  if (fY > oY + oH) {
    return false;
  }
  if (fY + fH < oY) {
    return false;
  }
  return true;
};

const updateScore = async () => {
  if (captchaDisplayed) {
    return;
  }
  const scoreElt = document.querySelector('#score');
  const foregroundElts = [...document.getElementsByClassName('foreground')];
  const obstacleElts = [...document.getElementsByClassName('obstacle')];
  const rewardElts = [...document.getElementsByClassName('reward')];
  const penaltyElts = [...document.getElementsByClassName('penalty')];
  const resetCooldown = true;
  for (let foregroundEltIx = 0; foregroundEltIx < foregroundElts.length; foregroundEltIx++) {
    const foregroundElt = foregroundElts[foregroundEltIx];
    for (let rewardEltIx = 0; rewardEltIx < rewardElts.length; rewardEltIx++) {
      const rewardElt = rewardElts[rewardEltIx];
      if (intersect(rewardElt, foregroundElt)) {
        const parentElement = rewardElt.parentElement;
        if(parentElement != null) {
          parentElement.removeChild(rewardElt);
          await incrementScore(rewardElt);
        }
      }
    }

    for (let penaltyEltIx = 0; penaltyEltIx < penaltyElts.length; penaltyEltIx++) {
      const penaltyElt = penaltyElts[penaltyEltIx];
      if (intersect(penaltyElt, foregroundElt)) {
        await incrementScore(penaltyElt);
      }
    }
  }
  scoreElt.innerText = 'Score:' + score + ' Moves Remaining:' + remaining;
};

const captchaClicked = (response) => {
  captchaDisplayed = false;
  // console.log('captchaClicked', response);
  if (!response.success) {
    displayErrorMessage('captcha failed. ' + response.message);
  } else {
    displayErrorMessage('captcha success. ' + response.message);
  }
  hideCaptcha();
};

const hideCaptcha = () => {
  const gameElt = document.querySelector('#game');
  set(gameElt, 'style', 'display:block');
};

const showCaptcha = () => {
  captchaDisplayed = true;
  const callback = (json) => {
    // const gameElt = document.querySelector('#game');
    // set(gameElt, 'style', 'display:none');
  };
  bmcaptcha.showCaptcha(callback);
};
