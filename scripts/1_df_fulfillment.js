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
//var oracle = "0x258b4adA9E315A0b0c2a8437E1A41F0767241F2A";
var doFulfill = true;

doFulfillment();

async function doFulfillment() {
    await getOracle();
    if (doFulfill) {
        await main().catch(e => console.error(e));
        await setFulfillTrue();
    } else {
        console.log("Fulfillment already done and marked completed.");
    }
    
}

async function getOracle() {
    const getOCAState = db.prepare(`SELECT EXISTS (SELECT 1 FROM ${tableDF} WHERE fulfill_done IS 0)`);
    let result = getOCAState.get();
    let state = (Object.values(result));
    console.log("state", state);

    if (state == 1 ) {  // row found that needs fulfillment done
        console.log("row found that needs fulfillment 1_df_fulfillment.js");
        const getOCA = db.prepare(`SELECT oracle FROM ${tableDF} WHERE fulfill_done IS 0 LIMIT 1`);
        let result = getOCA.get();
        oracle = result.oracle;
        console.log("\n");
        console.log(`The OCA to fulfill will be: ${chalk.green(oracle)}`);
    } else { // no rows need fulfillment done
        console.log("no rows need fulfillment 1_df_fulfillment.js");
        doFulfill = false;
    }
};

async function main() {
    const xdc3 = new Xdc3(
        new Xdc3.providers.HttpProvider(process.env.RPCURL)
    );

    const deployed_private_key = process.env.PRIVATEKEY;

    //Oracle ABI & Contract address to pass here
    const oracleABI = require("../build/contracts/Oracle.json").abi;
    // console.log("oracleABI",oracleABI);
    const oraclecontractAddr = oracle;
    const pluginNode = process.env.NODEADDRESS;

    //Defining OracleContract
    const oraclecontract = new xdc3.eth.Contract(oracleABI, oraclecontractAddr);
    //console.log("orclecontract", oraclecontract)
    const account = xdc3.eth.accounts.privateKeyToAccount(deployed_private_key);
    const nonce = await xdc3.eth.getTransactionCount(account.address);
    const gasPrice = await xdc3.eth.getGasPrice();

    const tx = {
        nonce: nonce,
        data: oraclecontract.methods.setFulfillmentPermission(pluginNode, true).encodeABI(),
        gasPrice: gasPrice,
        to: oraclecontractAddr,   
        from: account.address,
    };

    const gasLimit = await xdc3.eth.estimateGas(tx);
    tx["gasLimit"] = gasLimit;

    const signed = await xdc3.eth.accounts.signTransaction(
        tx,
        deployed_private_key
    );
    await xdc3.eth
        .sendSignedTransaction(signed.rawTransaction)
        //.once("receipt", console.log);

    let status = await oraclecontract.methods.getAuthorizationStatus(pluginNode)
    //console.log("Status", status);
    //is this doing anything?

    console.log("\n");
    console.log("OCA has been fulfilled, need to circle back to do actual check.");
}

async function setFulfillTrue() {
    const setTrue = db.prepare(`UPDATE ${tableDF} SET fulfill_done = 1 WHERE oracle = '${oracle}'`);
    setTrue.run();
    console.log("\n");
    console.log(`The OCA fulfillment is complete for ${chalk.green(oracle)}.  Need to circle back and put in a true test.`);

    const checkWork = db.prepare(`SELECT * FROM ${tableDF} WHERE oracle = '${oracle}'`);
    let result = checkWork.all();
    console.log(result)
}