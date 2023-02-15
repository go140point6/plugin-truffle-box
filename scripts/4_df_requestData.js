/* eslint-disable */
const h = require("@goplugin/plugin-test-helpers");
const Database = require("better-sqlite3");
const { Client } = require("pg");
const Xdc3 = require("xdc3");
const chalk = require("chalk");
const { sleep } = require('../utils/sleep');

require("dotenv").config();

const db = new Database('data/data.db', {verbose: console.log });
var tableModel = "topcrypto_model";
var tableNew;
var tableDF = "datafeed";

var oracle;
var ic;
var jobId;
var fsyms;
var tsyms;
var ic;
var datafeed;
var prevNonce;
var doTest = true;
var txConfirmed = false;

doTested();

async function doTested() {
    await getTested();
    if (doTest) {
        await main().catch(e => console.error(e));
        await confirmTx();
    }
}

async function getTested() {
    const getTestState = db.prepare(`SELECT EXISTS (SELECT 1 FROM ${tableDF} WHERE tested_done IS 0)`);
    let result = getTestState.get();
    let state = (Object.values(result));

    if (state == 1 ) {  // row found that needs fulfillment done
        const getTest = db.prepare(`SELECT oracle, jobid, fsyms, tsyms, ic, datafeed FROM ${tableDF} WHERE tested_done IS 0 LIMIT 1`);
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
    } else {
        doTest = false;
    }
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

//await sleep(10000); // wait 10 seconds

//const confirmTx = async () => {
//    try{
async function confirmTx() {
        let waitCount = 0;
        const client = new Client({
            user: process.env.PGUSER,
            host: process.env.PGHOST,
            database: process.env.PGDATABASE,
            password: process.env.PGPASSWORD,
            port: process.env.PGPORT
        });

        await client.connect();

        async function waitConfirm() {
            const str = oracle;
            const subStr = str.substring(2,42);
            //const res = await client.query(`SELECT state FROM eth_txes WHERE to_address = decode('${subStr}', 'hex') LIMIT 1`);
            const res = await client.query(`SELECT state FROM eth_txes WHERE to_address = decode('${subStr}', 'hex') ORDER BY created_at DESC LIMIT 1`);
            let rows = res.rows;
            console.log(rows);
            console.log(rows.length);
            
            if (waitCount < 10 ) {
                if (rows.length !== 0 ) {
                    if (rows[0].state === "confirmed") {
                        console.log("Tx: ", rows[0].state);
                        await client.end();
                        await setTestedTrue();
                        await setCompleteTrue();
                        await checkWork();
                    } else {
                        console.log("The state is: ", rows[0].state);
                        console.log("Rechecking in 4 seconds...");
                        waitCount++;
                        await setTimeout(waitConfirm, 4000);
                    }
                } else {
                    console.log("Tx hasn't written to DB yet, rechecking in 4 seconds...");
                    waitCount++;
                    await setTimeout(waitConfirm, 4000);
                    }
                } else {
                    //console.log(`Transaction taking to long, presumed failed.  This was attempt ${testCount} of 3.`);
                    console.log(`Transaction taking to long, presumed failed.`);
                    await client.end();
                    await checkWork();
                }
            }
            await waitConfirm();

//    }catch(error){
//        console.log(error)
//    }
}

async function setTestedTrue() {
    const setTest = db.prepare(`UPDATE ${tableDF} SET tested_done = 1 WHERE ic = '${ic}'`);
    setTest.run();
    console.log("\n");
    console.log(`The IC test is complete for ${chalk.green(ic)}.  Need to circle back and put in a true test.`);
}

async function setCompleteTrue() {
    const setComplete = db.prepare(`UPDATE ${tableDF} SET complete = 1 WHERE oracle_done = 1 AND fulfill_done = 1 AND jobid_done = 1 AND ic_done = 1 AND approve_done = 1 AND transfer_done = 1 AND tested_done = 1 AND touched = 1`);
    setComplete.run();
}

async function checkWork() {
    const checkWork = db.prepare(`SELECT * FROM ${tableDF} ORDER BY id DESC LIMIT 1`);
    let result = checkWork.all();
    console.log(result);
    }