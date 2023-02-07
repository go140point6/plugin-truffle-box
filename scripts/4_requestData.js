/* eslint-disable */
const h = require("@goplugin/plugin-test-helpers");
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
var jobId;
var fsyms;
var tsyms;
var ic;
var datafeed;
var prevNonce;

doTest();

async function doTest() {
    await getTested();
    await main().catch(e => console.error(e));
    await setTestedTrue();
    await checkWork()
}

async function getTested() {
    const getTest = db.prepare(`SELECT oracle, jobid, fsyms, tsyms, ic, datafeed FROM ${tableMain} WHERE tested IS 0`);
    let result = getTest.get();
    oracle = result.oracle;
    jobId = result.jobid;
    fsyms = result.fsyms.toUpperCase();
    tsyms = result.tsyms;
    ic = result.ic;
    datafeed = result.datafeed;

    console.log("\n");
    console.log(`The OCA to test will be: ${chalk.green(oracle)}`);
    console.log(`The jobId to test will be: ${chalk.green(jobId)}`);
    console.log(`The fsyms to test will be: ${chalk.green(fsyms)}`);
    console.log(`The tsyms to test will be: ${chalk.green(tsyms)}`);
    console.log(`The ic to test will be: ${chalk.green(ic)}`);
    console.log(`The datafeed to test will be: ${chalk.green(datafeed)}`);
}

async function main() {

    const xdc3 = new Xdc3(
        new Xdc3.providers.HttpProvider(process.env.RPCURL)
    );
    const deployed_private_key = process.env.PRIVATEKEY;
    //const jobIdHex = xdc3.utils.toHex(jobId);
    //const fsysm = "PLI";
    //const tsysm = "USD";

    //requestor ABI & Contract address to pass here
    const requestorABI = require("../build/contracts/InternalContract.json").abi;
    const requestorcontractAddr = ic;

    //Defining requestContract
    const requestContract = new xdc3.eth.Contract(requestorABI, requestorcontractAddr);

    const account = xdc3.eth.accounts.privateKeyToAccount(deployed_private_key);
    const nonce = await xdc3.eth.getTransactionCount(account.address);
    const gasPrice = await xdc3.eth.getGasPrice();

    const tx = {
        nonce: nonce,
        data: requestContract.methods.testMyFunc().encodeABI(),
        gasPrice: gasPrice,
        to: ic,   // Requestor contract address
        from: account.address,
    };

    const gasLimit = await xdc3.eth.estimateGas(tx);
    tx["gasLimit"] = gasLimit;

    const signed = await xdc3.eth.accounts.signTransaction(
        tx,
        deployed_private_key
    );

    const txt = await xdc3.eth
        .sendSignedTransaction(signed.rawTransaction)
        .once("receipt", console.log);
    request = h.decodeRunRequest(txt.logs[3]);
    console.log("request has been sent. request id :=" + request.id, request.data.toString("utf-8"))
}

async function setTestedTrue() {
    const setTest = db.prepare(`UPDATE ${tableMain} SET tested = 1 WHERE ic = '${ic}'`);
    setTest.run();
    console.log("\n");
    console.log(`The IC test is complete for ${chalk.green(ic)}.  Need to circle back and put in a true test.`);
}

async function checkWork() {
    const checkWork = db.prepare(`SELECT * FROM ${tableMain} WHERE ic = '${ic}'`);
    let result = checkWork.all();
    console.log(result)
    }