/* eslint-disable */
const Database = require('better-sqlite3');
const Xdc3 = require("xdc3");
const chalk = require("chalk");

require("dotenv").config();

const db = new Database('data/data.db', {verbose: console.log });
var tableModel = "topcrypto_model";
var tableNew;
var tableMain = "main";

var oracle;
var ic;
var prevNonce;

doTransfer();

async function doTransfer() {
    await getTransfer();
    await main().catch(e => console.error(e));
    await setTransferTrue();
    await checkWork()
}

const convertTokens = async (n) => {
    b = new Xdc3.utils.BN(Xdc3.utils.toWei(n.toString(), 'ether'));
    return b;
}

async function getTransfer() {
    const getApp = db.prepare(`SELECT ic FROM ${tableMain} WHERE transfer IS 0`);
    let result = getApp.get();
    ic = result.ic;

    console.log("\n");
    console.log(`The IC to transfer PLI to will be: ${chalk.green(ic)}`);
}

async function main() {
    const xdc3 = new Xdc3(
        new Xdc3.providers.HttpProvider(process.env.RPCURL)
    );

    const deployed_private_key = process.env.PRIVATEKEY;
    //Request ABI & Contract address to pass here
    const tokenABI = require("../build/contracts/PliTokenInterface.json").abi;

    //Defining tokenContract
    const tokenContract = new xdc3.eth.Contract(tokenABI, process.env.PLIADDRESS);
    // console.log("tokenContract", tokenContract)

    const _tokens = 0.5;
    const tokens = await convertTokens(_tokens);
    //console.log("Tokens are", tokens);
    console.log("Tokens as string", tokens.toString());
    const account = xdc3.eth.accounts.privateKeyToAccount(deployed_private_key);
    const nonce = await xdc3.eth.getTransactionCount(account.address);
    console.log("The nonce:", nonce);
    /* Database change if needed
    if (prevNonce === nonce) {
        console.log("The current nonce is the same as the previous, so make it +1")
        nonce++
        console.log(`The new nonce is: ${nonce}`);
        prevNonce = nonce;
    }
    */
    const gasPrice = await xdc3.eth.getGasPrice();
    const gasPrice1 = await xdc3.eth.getGasPrice();

    const tx1 = {
        nonce: nonce,
        data: tokenContract.methods.transfer(ic, tokens).encodeABI(),
        gasPrice: gasPrice1,
        to: process.env.PLIADDRESS,
        from: account.address,
    };

    // const gasLimit1 = await xdc3.eth.estimateGas(tx);
    tx1["gasLimit"] = 21000000;

    const signed1 = await xdc3.eth.accounts.signTransaction(
        tx1,
        deployed_private_key
    );

    await xdc3.eth
        .sendSignedTransaction(signed1.rawTransaction)
        .once("receipt", console.log);

    console.log("Success second txn")
}

async function setTransferTrue() {
    const setTrue = db.prepare(`UPDATE ${tableMain} SET transfer = 1 WHERE ic = '${ic}'`);
    setTrue.run();
    console.log("\n");
    console.log(`The IC approval is complete for ${chalk.green(ic)}.  Need to circle back and put in a true test.`);
}

async function checkWork() {
    const checkWork = db.prepare(`SELECT * FROM ${tableMain} WHERE ic = '${ic}'`);
    let result = checkWork.all();
    console.log(result)
    }