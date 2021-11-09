import {clear, addText, addChildElement, displayErrorMessage} from '../lib/util.js';

const onLoad = async () => {
  loadAdminKey();
  loadPayouts();
};

const loadAdminKey = () => {
  const adminKeyElt = document.querySelector('#adminKey');
  if (adminKeyElt !== null) {
    if (window.localStorage.adminKey !== undefined) {
      adminKeyElt.value = window.localStorage.adminKey;
    }
  }
};

const saveAdminKey = () => {
  const adminKeyElt = document.querySelector('#adminKey');
  window.localStorage.adminKey = adminKeyElt.value;
};

const updateAdminKey = () => {
  saveAdminKey();
  setAdminKey(window.localStorage.adminKey);
};

const clearAdminKey = () => {
  setAdminKey('');
};

const setAdminKey = async (adminKey) => {
  const response = await fetch('/admin_key', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: `{"admin_key":"${adminKey}"}`,
  });
  const responseJson = await response.json();
  // console.log('data_pack', responseJson);
  if (responseJson.success) {
    location.reload();
  } else {
    displayErrorMessage(responseJson.message);
  }
};

const clearScore = async (account) => {
  const response = await fetch('/clear_score', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: `{"admin_key":"${window.localStorage.adminKey}", "account": "${account}"}`,
  });
  const responseJson = await response.json();
  // console.log('data_pack', responseJson);
  if (responseJson.success) {
    location.reload();
  } else {
    displayErrorMessage(responseJson.message);
  }
};

const loadPayouts = async () => {
  const bananodeApiUrl = 'https://kaliumapi.appditto.com/api';

  const walletAccountElt = document.querySelector('#walletAccount');
  const walletAccount = walletAccountElt.innerText;

  const response = await fetch(bananodeApiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: `{"action": "account_history", "account":"${walletAccount}", "count":-1, "reverse":true}`,
  });
  const history = await response.json();
  if (history.history !== undefined) {
    const bananojs = window.bananocoinBananojs;

    const sendByAmount = {};
    const countByAmount = {};

    history.history.forEach((historyElt) => {
      if (historyElt.type == 'send') {
        const balanceParts = bananojs.getBananoPartsFromRaw(historyElt.amount);

        if (sendByAmount[historyElt.account] === undefined) {
          sendByAmount[historyElt.account] = 0;
        }
        if (countByAmount[historyElt.account] === undefined) {
          countByAmount[historyElt.account] = 0;
        }

        sendByAmount[historyElt.account] += parseInt(balanceParts.banoshi, 10);
        countByAmount[historyElt.account]++;
      }
    });

    const accounts = [...Object.keys(sendByAmount)];

    accounts.sort((a, b) => {
      const aBanano = sendByAmount[a];
      const bBanano = sendByAmount[b];
      return bBanano - aBanano;
    });

    const payoutsElt = document.querySelector('#payouts');
    clear(payoutsElt);

    const addHeader = () => {
      const trElt = addChildElement(payoutsElt, 'tr');
      const accountElt = addChildElement(trElt, 'td', {
        'class': 'align_top',
      });
      const amountElt = addChildElement(trElt, 'td', {
        'class': 'align_top',
      });
      const countElt = addChildElement(trElt, 'td', {
        'class': 'align_top',
      });
      const averageElt = addChildElement(trElt, 'td', {
        'class': 'align_top',
      });
      addText(accountElt, 'Account');
      addText(amountElt, 'Total Amount');
      addText(countElt, 'Payment Count');
      addText(averageElt, 'Average Payment');
    };
    addHeader();

    accounts.forEach((account) => {
      const banano = sendByAmount[account];
      const count = countByAmount[account];
      const average = parseInt(banano/count, 10);
      const trElt = addChildElement(payoutsElt, 'tr');
      const accountElt = addChildElement(trElt, 'td', {
        'class': 'align_top bordered',
      });
      const amountElt = addChildElement(trElt, 'td', {
        'class': 'align_top bordered',
      });
      const countElt = addChildElement(trElt, 'td', {
        'class': 'align_top bordered',
      });
      const averageElt = addChildElement(trElt, 'td', {
        'class': 'align_top bordered',
      });
      addText(accountElt, account);
      addText(amountElt, banano);
      addText(countElt, count);
      addText(averageElt, average);
    });
  }
};

window.onLoad = onLoad;
window.updateAdminKey = updateAdminKey;
window.clearAdminKey = clearAdminKey;
window.clearScore = clearScore;
