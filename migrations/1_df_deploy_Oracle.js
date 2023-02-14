const Oracle = artifacts.require("Oracle");
const chalk = require("chalk");
const fs = require("fs");
const Database = require('better-sqlite3');
const execSync = require('child_process').execSync;
require("dotenv").config();

const PLIADDRESS = process.env["PLIADDRESS"]; // This is either mainnet or apothem contract address

const db = new Database('../data/data.db', {verbose: console.log });
var tableModel = "topcrypto_model";
var tableNew;
var tableDF = "datafeed";

var oracle;
var jobId;
var datafeed; // tl_binance, tl_coingecko, etc (set in datafeed, one at a time)
var tsyms; // USDT, BTC, XDC, etc (set in tsyms, one at a time)
var doOCA = true;
var doJob = true;
var id;
var notDone = 0; // record is either missing (which is good, just means hasn't run yet) or in a completed state, only care about true value (1) here

module.exports = async function(deployer) {
    // Get datafeed and tsyms (work on one set at a time, i.e. tl_binance and USD --> then tl_binance and EUR or tl_coingecko and USD)
    await getStuff();
    await checkIfComplete();
    await checkWork();

    // Create OCA
    if (doOCA) { // if true
        await deployer.deploy(Oracle,PLIADDRESS);
        oracle = Oracle.address;
    } else {
        console.log("OCA already created: ", oracle);
    };
    
    // Set fulfillment for XinFin wallet address
    //if (doFulfill) {
    //    await doFulfillment();
    //};
    //await verifyFulfillment();

    // Create jobs 1:1 with each OCA created
    if (doJob) {
        await createJobs();
    } else {
        console.log("Job already created: ", jobId);
    };

    /// Create tables needed, Push OCA, JobId and Datafeed to the DB
    await checkTable();
    await checkColumn();
    await pushInitialDB()
    await checkWork();
}

async function get_line(filename, line_no, callback) {
    var data = fs.readFileSync(filename, 'utf8');
    var lines = data.split("\n");

    if (+line_no > lines.length) {
        throw new Error('File end reached without finding line');
    }
    
    callback(null, lines[+line_no]);
}

async function checkWork() {
    const checkWork = db.prepare(`SELECT * FROM ${tableDF} ORDER BY id DESC LIMIT 1`);
    let result = checkWork.all();
    console.log(result);
    }

async function getStuff() {
    await get_line('./datafeed', 0, function(err, line) {
        datafeed = line;
        tableNew = `topcrypto_${datafeed}`
    });

    await get_line('./tsyms', 0, function(err, line) {
        tsyms = line;
    });

    console.log("\n");
    console.log(`The datafeed deployOracle will use is: ${chalk.green(datafeed)}`);
    console.log(`The tsyms deployOracle will use use for the IC will be ${chalk.green(tsyms)}`);
    console.log(`The table to be created or used to track pairs created will be: ${chalk.green(tableNew)}`);
    console.log("\n");
}

async function checkIfComplete() {
    const checkComplete = db.prepare(`SELECT EXISTS (SELECT 1 FROM ${tableDF} WHERE complete = 0 AND touched = 1)`);
    //const checkComplete = db.prepare(`SELECT * FROM ${tableDF} WHERE complete = 0 AND touched = 1 ORDER BY id DESC LIMIT 1`);
    let results = checkComplete.get();
    //console.log(_.values(results));
    notDone = (Object.values(results));
    /*
    console.log(notDone);

    if ( notDone == 1 ) {
        console.log("true - not done");
    } else {
        console.log("false - done");
    }
}
*/
    if ( notDone == 1 ) {
        console.log("Found incomplete record, skipping elements already created.");
        const checkSingle = db.prepare(`SELECT * FROM ${tableDF} WHERE complete = 0 AND touched = 1 ORDER BY id DESC LIMIT 1`);
        let singleResult =  checkSingle.get();
        console.log(results);
        id = singleResult.id;
        console.log("The id of this result is: ", singleResult.id);
        if ( singleResult.oracle_done === 1 ) {
            doOCA = false;
            oracle = singleResult.oracle;
            console.log("The OCA is done and is: ", oracle);
        }
        if ( singleResult.jobid_done === 1 ) {
            doJob = false;
            jobId = singleResult.jobid;
            console.log("The Job is done and is: ", jobId);
        }
    }
}

async function createJobs() {
    let job_fname = "plinode_job_data-feeds.json"

    let init_name = process.env.PLI_L_INIT_NAME
    let init_endpoint = process.env.PLI_E_INIT_NAME

    let hostname = execSync('hostname -f', { encoding: 'utf-8' });  // the default is 'buffer'
    //console.log('Output was:\n', output);

    //console.log(datafeed);
    let job = `{"initiators": [{"type": "external","params": {"name": "${init_name}","body": {"endpoint": "${init_endpoint}","addresses": ["${oracle}"]}}}],"tasks": [{"type": "${datafeed}"},{"type": "copy","params": {"copyPath": ["result"]}},{"type": "multiply"},{"type": "ethuint256"},{"type": "EthTx"}]}}`

    //console.log(job);

    fs.writeFileSync(job_fname, job);

    execSync('plugin admin login -f ~/plugin-deployment/.env.apicred');
    execSync(`plugin job_specs create ${job_fname} > /tmp/plinode_job_id.raw`);
    execSync(`sed 's/ ║ /,/g;s/╬//g;s/═//g;s/║//g;s/╔//g;s/[[:space:]]//g' /tmp/plinode_job_id.raw > /tmp/plinode_job_id.raw1`)

    await get_line('/tmp/plinode_job_id.raw1', 4, function(err, line) {
        jobId = line.split(',')[0];
        //console.log(jobId)
    });
    
    console.log("\n")
    console.log(`The JobId for this Oracle is ${chalk.green(jobId)}`);
}

async function checkTable() {
    const checkTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableNew}'`)
    let result = checkTable.get();
    if (result) {
        console.log("\n")
        console.log(`The table ${chalk.green(tableNew)} exists, skipping creating...`);
    } else {
        console.log("\n")
        console.log(`The table ${chalk.green(tableNew)} doesn't exist, creating...`);
        await cloneModel();
    }
}

async function cloneModel() {
    const cloneModel = db.prepare(`CREATE TABLE ${tableNew} AS SELECT * FROM ${tableModel}`);
    cloneModel.run();
    console.log("\n")
    console.log(`${chalk.green(tableNew)} has been created`);
}

async function checkColumn() {
    const checkColumnExists = db.prepare(`SELECT COUNT(*) AS CNTREC FROM pragma_table_info('${tableNew}') WHERE name='${tsyms}'`);
    let result = checkColumnExists.get();
    var colState = (result.CNTREC);

    if (colState === 0) {
        console.log("\n")
        console.log(`Column ${chalk.green(tsyms)} DOES NOT exist in table ${chalk.green(tableNew)}, creating this column...`);
        await addColumn();
    } else {
        console.log("\n")
        console.log(`Column ${chalk.green(tsyms)} already exists in table ${chalk.green(tableNew)}, skipping...`);
    }
}

async function addColumn() {
    const add = db.prepare(`ALTER TABLE ${tableNew} ADD COLUMN "${tsyms}" BOOLEAN DEFAULT 0 NOT NULL CHECK (${tsyms} IN (0, 1))`)
    var result = add.run();
    //console.log(result);
    console.log("\n")
    console.log(`Column ${chalk.green(tsyms)} has been added to table ${chalk.green(tableNew)}`);
    await checkSameFandT();
}

async function checkSameFandT() {
    const block = db.prepare(`UPDATE ${tableNew} SET ${tsyms} = 1 WHERE symbol = '${tsyms}'`);
    block.run();
    console.log("\n")
    console.log(`Row with symbol ${chalk.green(tsyms)} has been marked complete since this is column ${chalk.green(tsyms)}`);
}

async function pushInitialDB() {
    console.log("\n")
    console.log(oracle);
    console.log(jobId);
    console.log(datafeed);
    console.log(tsyms);
    
    if ( notDone == 0 ) {
        const pushNew = db.prepare(`INSERT INTO ${tableDF}(oracle, jobid, datafeed, tsyms) VALUES('${oracle}', '${jobId}', '${datafeed}', '${tsyms}')`);
        pushNew.run();    
        const setTrue = db.prepare(`UPDATE ${tableDF} SET oracle_done = 1, jobid_done = 1, touched = 1 WHERE oracle = '${oracle}' AND jobid = '${jobId}'`);
        setTrue.run();
    }
    if (doOCA && notDone == 1 ) {
        const pushOCA = db.prepare(`UPDATE ${tableDF} SET oracle = '${oracle}', oracle_done = 1 WHERE id = '${id}'`);
        pushOCA.run();
    }
    if (doJob && notDone == 1 ) {
        const pushJob = db.prepare(`UPDATE ${tableDF} SET jobid = '${jobId}', jobid_done = 1 WHERE id = '${id}'`);
        pushJob.run();
    }
    //const testIt = db.prepare(`UPDATE ${tableDF} SET oracle_done = 0 WHERE id = 1`)
    //const testIt = db.prepare(`UPDATE ${tableDF} SET jobid_done = 0 WHERE id = 1`)
    //testIt.run();
    const checkIt = db.prepare(`SELECT * FROM ${tableDF} ORDER BY id DESC LIMIT 3`);
    let result = checkIt.all();
    console.log(result);
}
