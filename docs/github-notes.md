### to force only one version of banano-side-scroller

    rm -rf .git;
    git init;
    git checkout -b main;
    find . -exec touch {} \;
    git add .;
    git commit -m "Initial commit";
    git remote add origin https://github.com/BananoCoin/banano-side-scroller.git;
    git push -u --force origin main;
    git branch --set-upstream-to=origin/main main;
    git pull;git push;

## to update the server when it has unrelated histories.

    git fetch --all;
    git reset --hard origin/main;
    npm i;   
    npm audit fix;
    rm screenlog.0;
    npm run screenrestart;
