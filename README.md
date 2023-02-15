# Plugin - A Decentralized Oracle Network Powered by XDC
## Plugin Crypto Adapter Truffle Box - By GoPlugin (with a little help by go140point6)

This version of Plugin Crypto Adapter Truffle Box fully automates contract creation for Oracles and InternalContracts, as well as interacts with them both in an an automated way.

## What it does
- It runs against Apothem or Mainnet by changing command switch.
- Create up to 10 contract pairs at a time (more with the force switch).
- It creates 1:1:1 Oracle to JobId to InternalContract
- It runs fulfillment on the OCA.
- It runs approval and transfer of PLI funds to the ICA.
- It runs a test against the crypto pair and datafeed set.
- Most importantly, it tracks all this in a lightweight SQLite database.

## .env should have following parameters
- See .env-sample.  Copy it to .env and edit where noted. Be sure to uncomment only one of the networks.

Note: You need to export your XinFin wallet address private key and keep this in plain-text on your VPS host.  For mainnet, it is recommended that you
create a second wallet address, fund with just enough PLI and XDC to deploy your contracts, and keep it separate from your main rewards wallet.
Proceed with caution and make sure secure your VPS!

If doing apothem testing, you will need to get XDC and PLI from the apothem faucets.

## Recommended setup

- For testing, an apothem node is highly recommended.  Use my repo on the apothem branch to quickly set up an apothem node:
```
https://github.com/go140point6/plugin-deployment/tree/apothem
```
- In either case, this will create jobs on whatever node it is run on as currently it only creates jobs against localhost.
- Be sure to install and run the latest external-adapter-feeds repo from the official GoPlugin github, and create the bridges you want to use as documented there.

## How to run

###
- Before you use the repo, you need to upgrade your node version to something more current than the plugin node is using.  You will do this locally, not globally.  The plugin node will continue to use the global node version 15 I believe (doesn't seem to be affected in any case).

- install latest nvm
```
cd ~
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
```
exit and restart your terminal session

- install latest LTS version of node (currently v18.14.0)
```
nvm install --lts
```

- Now install the repo and install the packages
```
git clone https://github.com/go140point6/plugin-truffle-box.git
cd plugin-truffle-box
npm install
```

- Configure your specific environment variables in .env, adding your private key, node regular address, and postgres passwords, as well as selecting either apothem or mainnet configuration.
```
cp .env-sample .env
```

- Copy datafeed-sample to datafeed, and tsyms-sample to tsyms, edit both appropriately
```
cp datafeed-sample datafeed
cp tsyms-sample tsyms
```

- Set up the database using the stand-alone script.  Note, the file startClean.sh in root will IMMEDIATELY wipe out and recreate the database clean, so use with caution.
```
node scripts/101_createDB.js
```
Lots of debug info currently, scroll up and look specifically for "No duplicate symbols found, that's good!" which tells you the first 250 crypto by marketcap had no ticker symbols in common.

- Next, there are two text files 'datafeed' and 'tsyms'.  Whatever you named your bridge, use in datafeed (i.e. tl_binance).  Whatever pair base you working with, use tsyms (i.e. USDT).  Note that some datafeeds (like tl_binance) don't work with fiat bases (like USD).  Be sure to test against apothem before running a multiRun.sh.

- Now it's time to run.  Start with the single, then crank it up.  Be sure to change the tsyms base and datafeed as needed.
```
./singleRun -n apothem (or mainnet)
OR
./multiRun -x 10 -n apothem (or mainnet)
```
note that if doing more than 10, you will get a warning and must add -f true to your request.

## What's next?
- scripts for database maintenance.
- better tests to ensure steps are actually carried out.
- database table for logging errors?
- script to sweep the deployed OCA's and pull back earned PLI to wallet.

## GoPlugin Installation Documentation
- https://docs.goplugin.co/