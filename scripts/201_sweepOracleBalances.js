/* eslint-disable */
const Database = require('better-sqlite3');
const Xdc3 = require("xdc3");
const chalk = require("chalk");

require("dotenv").config();

const db = new Database('data/data.db', {verbose: console.log });
var tableModel = "topcrypto_model";
var tableNew;
var tableDF = "datafeed";

//var oracle;
var numOracles;
//var oracle = "0x90a790517C1211741Ac24FF0A6439dc310C5262e"
//var oracle = "0xEB99A256B7ca1705e3371aAe882492a58f147D95"
//var doFulfill = true;
var count;

var objOracles = [];

sweepOracles();

//getOracleCount();
//getOCAs();
//getAllOCAs();

async function sweepOracles() {
    await getOracleCount();
    await getAllOCAs();
    console.log(objOracles);
    //objOracles.forEach(o => console.log(o));
    //objOracles.forEach(await main().catch(e => console.error(e)));
    for (let i = 0; i < objOracles.length; i++) {
        let oracle = objOracles[i];
        console.log("Sweeping OCA: ", oracle);
        await main(oracle).catch(e => console.error(e));
    }
}

async function getOracleCount() {
    const countOracles = db.prepare(`SELECT COUNT(*) FROM ${tableDF}`)
    numOracles = countOracles.get();
    //console.log(numOracles);
    count = (Object.values(numOracles));
    console.log("Number of OCA's to sweep: ", count);
};

async function getAllOCAs() {
    let offset = 0;
    for (let i = 0; i < count; i++) {
        const getOCA = db.prepare(`SELECT oracle FROM ${tableDF} LIMIT 1 OFFSET ${offset}`)
        let result = getOCA.get();
        let oracles = result.oracle;
        //console.log(oracle);
        //main().catch(e => console.error(e));
        objOracles.push(oracles);
        offset++
    }
}

//main().catch(e => console.error(e));

async function main(oracle) {
    const xdc3 = new Xdc3(
        new Xdc3.providers.HttpProvider(process.env.RPCURL)
    );

    const deployed_private_key = process.env.PRIVATEKEY;

    //Oracle ABI & Contract address to pass here
    const oracleABI = require("../json/Oracle.json").abi;
    // console.log("oracleABI",oracleABI);
    const oraclecontractAddr = oracle;
    const pluginNode = process.env.NODEADDRESS;

    //Defining OracleContract
    const oraclecontract = new xdc3.eth.Contract(oracleABI, oraclecontractAddr);
    //console.log("orclecontract", oraclecontract)
    const account = xdc3.eth.accounts.privateKeyToAccount(deployed_private_key);
    const nonce = await xdc3.eth.getTransactionCount(account.address);
    console.log("Nonce: ", nonce);
    const gasPrice = await xdc3.eth.getGasPrice();

    //const getOwner = await oraclecontract.methods.owner();
    console.log("OCA to sweep: ", oraclecontractAddr);
    const getOwner = await oraclecontract.methods.owner().call();
    console.log("Owner: ", getOwner);

    console.log("Owner of OCA and desitination of funds: ", getOwner);
    const getWithdrawable = await oraclecontract.methods.withdrawable().call( {from: account.address} );
    if (getWithdrawable > 0) {
        console.log("Amount of PLI in OCA that will be withdrawn: ", getWithdrawable);
        const tx = {
            nonce: nonce,
            data: oraclecontract.methods.withdraw(account.address, getWithdrawable).encodeABI(),
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
        const checkWithdrawable = await oraclecontract.methods.withdrawable().call( {from: account.address} );
        console.log("Amount of PLI left in the OCA: ", checkWithdrawable);
        console.log("Completed sweeping this OCA of PLI.");
    } else {
        console.log("Amount in this OCA is zero, skipping...");
    }
}