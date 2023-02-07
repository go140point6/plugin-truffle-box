# Plugin - A Decentralized Oracle Network Powered by XDC
## Plugin Crypto Adapter Truffle Box - By GoPlugin (with a little help by go140point6)

This version of Plugin Crypto Adapter Truffle Box fully automates contract creation for Oracles and InternalContracts, as well as interacts with them both in an an automated way.

## What it does
- It runs against Apothem or Mainnet by changing command switch.
- Create up to 10 contract pairs at a time (more with the force switch).
- It creates 1:1:1 Oracle to JobId to InternalContract
- It runs fulfillment on the OCA.
- It runs approval and transfer of PLI funds to the ICA.
- It run a test against the crypto pair and datafeed set.
- Most importantly, it tracks all this in a lightweight SQLite database.

## .env should have following parameters
- See .env-sample.  Copy it to .env and edit where noted. Be sure to uncomment only one of the networks.

Note: You need to export your XinFin wallet address private key and keep this in plain-text on your VPS host.  For mainnet, it is recommended that you
create a second wallet address, fund with just enough PLI and XDC to deploy your contracts, and keep it separate from your main rewards wallet.
Proceed with caution and make sure secure your VPS!

## Recommended setup

- For testing, an apothem node is highly recommended.  Use my repo on the apothem branch to quickly set up an apothem node:
```
https://github.com/go140point6/plugin-deployment/tree/apothem
```
- In either case, this will create jobs on whatever node it is run on as currently it only creates jobs against localhost.
- Be sure to install and run the latest external-adapter-feeds repo from the official GoPlugin github, and create the bridges you want to use as documented there.

## How to run

### 



## GoPlugin Installation Documentation
- https://docs.goplugin.co/