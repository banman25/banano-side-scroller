const onLoad = async () => {
  loadAdminKey();
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

window.onLoad = onLoad;
window.updateAdminKey = updateAdminKey;
window.clearAdminKey = clearAdminKey;
window.clearScore = clearScore;
