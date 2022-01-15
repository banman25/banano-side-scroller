# installation instructions

  [installation instructions](docs/installation.md)

# banano-side-scroller

    banano side scroller

# run the following command to start:

    npm start;

## to run in background, use the command:

    npm run screenstart;

## to stop, use the command:

    npm stop;

### to stop and restart, use the command:

    npm run screenrestart;

### todo

0. add stats:
- average playing time
- histogram of longest bm win streak
- histogram of win/loss ratio per player.

0.  do captcha countdown reload on a  timer, so it doesn't spam it.

1.  add token valid time to response, so req doesn't spam tokens.

2.  add captcha timer, in case bots are just doing the captcha over and over.

3.  add payout cap, so if the payout is above the cap, it will just be at the cap. (to make refilling not mess with the cap as much)
