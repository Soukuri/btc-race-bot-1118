# btc-race-bot-1118
[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/Soukuri/btc-race-bot-1118/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/Soukuri/btc-race-bot-1118/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A trend-aware dip buyer for the cbBTC 1-minute bars race, long only. It buys a dip only while the slow (240-bar) trend is not down, so the dip is a pause in an advance rather than a falling knife, and it also takes a deep capitulation bounce when a fall turns up. Exits trail the recovery, with a take-profit, a hard stop and a maximum hold; a cooldown after each exit keeps one market from churning the bot through fees. On the competition's frozen dev window it graded +$15.06 over 4 trades, ahead of every house baseline.

## Run it

The bot is a single `main.ts` (Node 22, standard library plus the vendored bars SDK in `vendor/`) speaking the make.fun bars-replay protocol: it reads one JSON line per minute and answers with buy and sell orders.

<sub>Entered on [make.fun](https://make.fun/?ref=xvx3ahvr&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
