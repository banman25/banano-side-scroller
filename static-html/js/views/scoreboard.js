import {clear, addText, addChildElement, displayErrorMessage} from '../lib/util.js';

const ZERO = BigInt(0);

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
    body: `{"action": "account_history", "account":"${walletAccount}", "count":-1, "reverse":false}`,
  });
  const history = await response.json();
  // console.log('loadPayouts', history);
  if (history.history !== undefined) {
    const bananojs = window.bananocoinBananojs;

    const sendByDateAndAmount = {};
    const allAccountsSet = new Set();
    const accountMinDate = {};

    history.history.forEach((historyElt) => {
      if (historyElt.type == 'send') {
        const date = new Date(historyElt.local_timestamp * 1000).toISOString().substring(0, 10);
        // console.log('date', date);

        if (sendByDateAndAmount[date] === undefined) {
          sendByDateAndAmount[date] = {};
        }

        accountMinDate[historyElt.account] = date;

        allAccountsSet.add(historyElt.account);

        const sendByAmount = sendByDateAndAmount[date];

        if (sendByAmount[historyElt.account] === undefined) {
          sendByAmount[historyElt.account] = BigInt(0);
        }

        sendByAmount[historyElt.account] += BigInt(historyElt.amount);
      }
    });

    const payoutsElt = document.querySelector('#payouts');
    clear(payoutsElt);

    const allAccounts = [...allAccountsSet];

    allAccounts.sort((a, b) => {
      const aMinDate = accountMinDate[a];
      const bMinDate = accountMinDate[b];
      return bMinDate.localeCompare(aMinDate);
    });

    if (allAccounts.length > 50) {
      allAccounts.length = 50;
    }

    const addHeader = () => {
      const trElt = addChildElement(payoutsElt, 'tr');
      const dateElt = addChildElement(trElt, 'td', {
        class: 'align_top whitespace_no_wrap',
      });
      addText(dateElt, 'Date');

      allAccounts.forEach((account, accountIx) => {
        const accountElt = addChildElement(trElt, 'td', {
          class: 'align_top small',
        });
        addText(accountElt, accountIx+1, {
          title: account,
        });
      });
    };
    addHeader();

    const dates = [...Object.keys(sendByDateAndAmount)];
    // console.log('loadPayouts', dates);
    dates.sort((a, b) => {
      return b.localeCompare(a);
    });

    dates.forEach((date) => {
      const sendByAmount = sendByDateAndAmount[date];

      allAccounts.forEach((account) => {
        if (sendByAmount[account] === undefined) {
          sendByAmount[account] = 0;
        }
      });

      const trElt = addChildElement(payoutsElt, 'tr');
      const dateElt = addChildElement(trElt, 'td', {
        class: 'align_top whitespace_no_wrap',
      });
      addText(dateElt, date);

      allAccounts.forEach((account) => {
        const raw = sendByAmount[account];
        const accountElt = addChildElement(trElt, 'td', {
          class: 'align_top small',
        });
        if (raw > ZERO) {
          const balanceParts = bananojs.getBananoPartsFromRaw(raw);
          const banano = balanceParts.banano;

          // console.log('date', date, 'account', account, 'amount', raw, 'banano', banano);

          const squareElt = addChildElement(accountElt, 'div', {
            class: 'black_background white_foreground',
            title: account,
          });
          addText(squareElt, banano, {
            title: account,
          });
        }
      });
    });
  }
};

window.onLoad = onLoad;
window.updateAdminKey = updateAdminKey;
window.clearAdminKey = clearAdminKey;
window.clearScore = clearScore;
