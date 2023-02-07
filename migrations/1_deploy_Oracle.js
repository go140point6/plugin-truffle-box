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
var tableMain = "main";

var oracle;
var jobId;
var datafeed; // tl_binance, tl_coingecko, etc (set in datafeed.txt, one at a time)
var tsyms; // USDT, BTC, XDC, etc (set in tsyms.txt, one at a time)

module.exports = async function(deployer) {
    // Get datafeed and tsyms (work on one set at a time, i.e. tl_binance and USD --> then tl_binance and EUR or tl_coingecko and USD)
    await getStuff();

    // Create OCA
    await deployer.deploy(Oracle,PLIADDRESS);
    
    // Set fulfillment for XinFin wallet address
    //await doFulfillment();
    //await verifyFulfillment();

    // Create jobs 1:1 with each OCA created
    await createJobs();

    /// Create tables needed, Push OCA, JobId and Datafeed to the DB
    await checkTable();
    await checkColumn();
    await pushInitialDB()
}

async function get_line(filename, line_no, callback) {
    var data = fs.readFileSync(filename, 'utf8');
    var lines = data.split("\n");

    if (+line_no > lines.length) {
        throw new Error('File end reached without finding line');
    }
    
    callback(null, lines[+line_no]);
}

async function getStuff() {
    await get_line('./datafeed.txt', 0, function(err, line) {
        datafeed = line;
        tableNew = `topcrypto_${datafeed}`
    });

    await get_line('./tsyms.txt', 0, function(err, line) {
        tsyms = line;
    });

    console.log("\n");
    console.log(`The datafeed deployOracle will use is: ${chalk.green(datafeed)}`);
    console.log(`The tsyms deployOracle will use use for the IC will be ${chalk.green(tsyms)}`);
    console.log(`The table to be created or used to track pairs created will be: ${chalk.green(tableNew)}`);
    console.log("\n");
}

async function createJobs() {
    let job_fname = "plinode_job_data-feeds.json"

    oracle = Oracle.address;
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
    let results = checkTable.get();
    if (results) {
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
    let results = checkColumnExists.get();
    var colState = (results.CNTREC);

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
    const add = db.prepare(`UPDATE ${tableNew} SET ${tsyms} = 1 WHERE symbol = '${tsyms}'`);
    var result = add.run();
    console.log("\n")
    console.log(`Row with symbol ${chalk.green(tsyms)} has been marked complete since this is column ${chalk.green(tsyms)}`);
}

async function pushInitialDB() {
    console.log("\n")
    console.log(oracle);
    console.log(jobId);
    console.log(datafeed);
    console.log(tsyms);
    const push = db.prepare(`INSERT INTO ${tableMain}(oracle, jobid, datafeed, tsyms) VALUES('${oracle}', '${jobId}', '${datafeed}', '${tsyms}')`);
    let result = push.run();
    const checkIt = db.prepare(`SELECT * FROM ${tableMain} ORDER BY id DESC LIMIT 3`);
    let result1 = checkIt.all();
    console.log(result1);
}