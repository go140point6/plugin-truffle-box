/* eslint-disable */
const Database = require('better-sqlite3');
const Xdc3 = require("xdc3");
const chalk = require("chalk");

require("dotenv").config();

const db = new Database('data/data.db', {verbose: console.log });
var tableModel = "topcrypto_model";
var tableNew;
var tableDF = "datafeed";

var oracle;
var ic;
var prevNonce;
var doApp = true;

doApprove();

async function doApprove() {
    await getApprove();
    if (doApp) {
        await main().catch(e => console.error(e));
        await setApproveTrue();
        await checkWork()
    }
    
}

const convertTokens = async (n) => {
    b = new Xdc3.utils.BN(Xdc3.utils.toWei(n.toString(), 'ether'));
    return b;
}

async function getApprove() {
    const getAppState = db.prepare(`SELECT EXISTS (SELECT 1 FROM ${tableDF} WHERE approve_done IS 0)`);
    let result = getAppState.get();
    let state = (Object.values(result));

    if (state == 1 ) {  // row found that needs approval done
        const getApp = db.prepare(`SELECT ic FROM ${tableDF} WHERE approve_done IS 0 LIMIT 1`);
        let result = getApp.get();
        ic = result.ic;
        console.log("\n");
        console.log(`The IC to approve will be: ${chalk.green(ic)}`);
    } else { // no rows need fulfillment done
        doApp = false;
    }
};

async function main() {
    const xdc3 = new Xdc3(
        new Xdc3.providers.HttpProvider(process.env.RPCURL)
    );

    const deployed_private_key = process.env.PRIVATEKEY;
    //Request ABI & Contract address to pass here
    const tokenABI = require("../build/contracts/PliTokenInterface.json").abi;
    const requestABi = require("../build/contracts/InternalContract.json").abi;

    //Defining tokenContract
    const tokenContract = new xdc3.eth.Contract(tokenABI, process.env.PLIADDRESS);
    // console.log("tokenContract", tokenContract)
    //Defining tokenContract
    const requestContract = new xdc3.eth.Contract(requestABi, ic);
    // console.log("requestContract", requestContract)

    const _tokens = 0.005;
    const tokens = await convertTokens(_tokens);
    //console.log("Tokens are", tokens);
    console.log("Tokens as string", tokens.toString());
    const account = xdc3.eth.accounts.privateKeyToAccount(deployed_private_key);
    const nonce = await xdc3.eth.getTransactionCount(account.address);
    console.log("The nonce:", nonce);
    prevNonce = nonce;
    const gasPrice = await xdc3.eth.getGasPrice();
    console.log("gasPrice",gasPrice)
    const tx = {
        nonce: nonce,
        data: tokenContract.methods.approve(ic, tokens).encodeABI(),
        gasPrice: gasPrice,
        to: process.env.PLIADDRESS,
        from: account.address,
    };

    // const gasLimit = await xdc3.eth.estimateGas(tx);
    tx["gasLimit"] = 210000;
    // console.log("Gas limit is", gasLimit);

    const signed = await xdc3.eth.accounts.signTransaction(
        tx,
        deployed_private_key
    );
    await xdc3.eth
        .sendSignedTransaction(signed.rawTransaction)
        .once("receipt", console.log);

    console.log("Success first txn");
}

async function setApproveTrue() {
    const setTrue = db.prepare(`UPDATE ${tableDF} SET approve_done = 1 WHERE ic = '${ic}'`);
    setTrue.run();
    console.log("\n");
    console.log(`The IC approval is complete for ${chalk.green(ic)}.  Need to circle back and put in a true test.`);
}

async function checkWork() {
    const checkWork = db.prepare(`SELECT * FROM ${tableDF} WHERE ic = '${ic}'`);
    let result = checkWork.all();
    console.log(result)
    }

