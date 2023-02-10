/* eslint-disable */
const h = require("@goplugin/plugin-test-helpers");
const Database = require('better-sqlite3');
const Xdc3 = require("xdc3");
const chalk = require("chalk");
const { Client } = require("pg");
const { sleep } = require('../utils/sleep');

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
var testCount = 0;
var waitCount = 0;

doTest();

async function doTest() {
    await getTested();
    await main().catch(e => console.error(e));
    await setTestedTrue();
    await checkWork()
    //await confirmSuccess();
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
    //console.log("waiting 15 seconds before checking tx was recorded by the oracle.")
    //await sleep(15000); // wait 15 seconds

}

async function setTestedTrue() {
    const setTest = db.prepare(`UPDATE ${tableMain} SET tested = 1 WHERE ic = '${ic}'`);
    setTest.run();
    console.log("\n");
    console.log(`The IC test is complete for ${chalk.green(ic)}.`);
}

async function checkWork() {
    const checkWork = db.prepare(`SELECT * FROM ${tableMain} WHERE ic = '${ic}'`);
    let result = checkWork.all();
    console.log(result)
}

const confirmSuccess = async () => {
    try {
        const client = new Client({
            user: process.env.PGUSER,
            host: process.env.PGHOST,
            database: process.env.PGDATABASE,
            password: process.env.PGPASSWORD,
            port: process.env.PGPORT
        });

        await client.connect();
        
        async function waitForConfirm() {
            const str = oracle;
            //console.log(str);
            const subStr = str.substring(2,42);
            //console.log(subStr);
            const res = await client.query(`SELECT state, error FROM eth_txes WHERE to_address = decode('${subStr}', 'hex')`);
            let rows = res.rows;
            if ( waitCount < 10 ) {
                if (rows.length !== 0 ) {
                    //console.log("rows exist");
                    if (rows[0].state === "confirmed") {
                        console.log("Tx ", rows[0].state);
                        await client.end()
                        await setTestedTrue();
                        await checkWork();
                    } else if (rows[0].state === "fatal_error") {
                        console.log("Tx Failed with error: ", rows[0].error);
                        console.log("Attempting test of IC again...");
                        await client.end();
                        testCount++;
                        doTest();
                    } else {
                        console.log("The state is: ", rows[0].state);
                        console.log("Rechecking in 3 seconds..");
                        waitCount++; // Increase the count, total tx shouldn't take more than 30 seconds max
                        await setTimeout(waitForConfirm, 3000);
                    }
                } else {
                    console.log("Transaction hasn't written to the database yet... recheck in 3 seconds.");
                    waitCount++; // Increase the count, total tx shouldn't take more than 30 seconds max
                    await setTimeout(waitForConfirm, 3000);
                }
            }  else {
                console.log(`Transaction taking to long, presumed failed.  This was attempt ${testCount} of 3.`);
                if ( testCount >= 3 ) {
                    console.log(`Giving up, tx failed for some reason, please check.`);
                    await client.end();
                } else {
                    console.log("Attempting test of IC again...");4
                    await client.end();
                    testCount++;
                    doTest();
                }
            }
        }

        await waitForConfirm();

        } catch (error) {
            console.error(error)
            }
}