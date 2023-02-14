// Stand-alone script to create the initial DB and tables needed
// node 101_createDB.js
// (the fiat choice is arbitrary as likely the marketcap ranking is the same no matter what)
const axios = require('axios');
const Database = require('better-sqlite3');
//const fs = require('fs');

const db = new Database('data/data.db', {verbose: console.log });
var oracle_done = 0;
var fulfill_done = 0;
var jobid_done = 0;
var ic_done = 0;
var approve_done = 0;
var transfer_done = 0;
var tested_done = 0;
var touched = 0;
var complete = 0;


//var tsyms;
//var fsyms;
//var datafeed;
//var tableNew;

var tableDF = "datafeed";
var tableModel = "topcrypto_model";

var fieldsDF = `(id INTEGER PRIMARY KEY AUTOINCREMENT,
                oracle TEXT UNIQUE,
                oracle_done BOOLEAN DEFAULT 0 NOT NULL CHECK (${oracle_done} IN (0, 1)),
                fulfill_done BOOLEAN DEFAULT 0 NOT NULL CHECK (${fulfill_done} IN (0, 1)),
                jobid TEXT UNIQUE,
                jobid_done BOOLEAN DEFAULT 0 NOT NULL CHECK (${jobid_done} IN (0, 1)),
                fsyms TEXT,
                tsyms TEXT,
                ic TEXT UNIQUE,
                ic_done BOOLEAN DEFAULT 0 NOT NULL CHECK (${ic_done} IN (0, 1)),
                approve_done BOOLEAN DEFAULT 0 NOT NULL CHECK (${approve_done} IN (0, 1)),
                transfer_done BOOLEAN DEFAULT 0 NOT NULL CHECK (${transfer_done} IN (0, 1)),
                tested_done BOOLEAN DEFAULT 0 NOT NULL CHECK (${tested_done} IN (0, 1)),
                touched BOOLEAN DEFAULT 0 NOT NULL CHECK (${touched} IN (0, 1)),
                complete BOOLEAN DEFAULT 0 NOT NULL CHECK (${complete} IN (0, 1)),
                datafeed TEXT)`;
var fieldsM = "(id TEXT PRIMARY KEY, market_cap_rank TEXT, symbol TEXT, name TEXT)";
var createDF = `CREATE TABLE IF NOT EXISTS ${tableDF} ${fieldsDF}`;
var createM = `CREATE TABLE IF NOT EXISTS ${tableModel} ${fieldsM}`;
const createTableDF = db.prepare(createDF);
const createTableM = db.prepare(createM);
createTableDF.run();
createTableM.run();


createDB(); // Create model table and pull from Coin Gecko, check for duplicate symbols.

async function createModel() {
        await axios.get(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=USD&order=market_cap_desc&per_page=250&page=1&sparkline=false`).then(res => {

            //console.log(res.data);

            const insertModel = db.prepare(`INSERT INTO ${tableModel} (id, market_cap_rank, symbol, name) VALUES (@id, @market_cap_rank, @symbol, @name)`);

            const insertManyModel = db.transaction((pairs) => {
                for (const pair of pairs) {
                    insertModel.run(pair)
                }
            });
        
            insertManyModel(res.data);
        });
};

async function checkDup() {
    //const count = db.prepare(`SELECT symbol, COUNT(*) c FROM ${tableP} GROUP BY symbol HAVING c < 1`);
    //var results4 = count.all();
    //console.log(results4);
    //const count2 = db.prepare(`SELECT id, COUNT(symbol) FROM ${tableP} GROUP BY market_cap_rank`);
    const count2 = db.prepare(`SELECT id, COUNT(symbol) FROM ${tableModel} GROUP BY market_cap_rank HAVING COUNT(symbol) > 1`);
    var results5 = count2.all();
    //console.log(results5);
    if (results5) {
        console.log("No duplicate symbols found, that's good!");
    } else {
        console.log(results5);
    }
}

async function makeUpper() { // make sure symbol is all uppercase
    const upper = db.prepare(`UPDATE ${tableModel} set symbol = upper(symbol)`);
    let result = upper.run();
    const checkUpper = db.prepare(`SELECT symbol FROM ${tableModel} LIMIT 5`)
    let result2 = checkUpper.all();
    console.log(result2);
}

async function createDB() {
    await createModel();
    const stmt = db.prepare(`SELECT * FROM ${tableModel} LIMIT 5`);
    var results = stmt.all();
    console.log(results);
    console.log(`Showing first 5 rows of table ${tableModel} for review`);
    await showColumns();
    await checkDup();
    await makeUpper();
};

// Dev testing stuff below

async function getStuff() {
    await get_line('../datafeed', 0, function(err, line) {
        datafeed = line;
        //console.log(line);
        tableNew = `topcrypto_${datafeed}`;
        //console.log(datafeed);
        //console.log(tableNew);
    });

    await get_line('../tsyms', 0, function(err, line) {
        //console.log(line)
        tsyms = line;
        //console.log(tsyms);
    });
}

async function get_line(filename, line_no, callback) {
    var data = fs.readFileSync(filename, 'utf8');
    var lines = data.split("\n");

    if (+line_no > lines.lenght) {
        throw new Error('File end reached without finding line');
    }
    
    callback(null, lines[+line_no]);
}

async function showColumns() {
    const showColumns = db.prepare(`PRAGMA table_info(${tableDF})`);
    var results4 = showColumns.all();
    console.log(results4);
    console.log(`Showing columns of ${tableDF} for review`);
}

async function cloneModel() {
    const cloneModel = db.prepare(`CREATE TABLE ${tableNew} AS SELECT * FROM ${tableModel}`);
    var result8 = cloneModel.run();
    //console.log(result8);
    const stmt = db.prepare(`SELECT * FROM ${tableNew}`);
    var results = stmt.all();
    console.log(results);
}

async function checkColumn() {
    // Check if column exists
    // NOTE: single quotes around column name are required!
    // NOTE: .get vs .all is important... figure it out (maybe obj of obj vs just the obj?)
    const checkColumn1 = db.prepare(`SELECT COUNT(*) AS CNTREC FROM pragma_table_info('${tableNew}') WHERE name='${tsyms}'`);
    //const checkColumn1 = db.prepare(`SELECT CASE WHEN (SELECT name FROM pragma_table_info('${tableP}') WHERE name = '${tsyms}') IS NULL THEN 'no column' ELSE 'found ${tsyms}' END`)
    //const checkColumn1 = db.prepare(`SELECT COALESCE(MAX(name), 'no column') FROM pragma_table_info('${tsyms}') WHERE name = '${tsyms}' `)
    var results1 = checkColumn1.get();
    console.log(typeof(results1));
    console.log(results1);
    var colState = (results1.CNTREC);

    if (colState === 0) {
        console.log(`column ${tsyms} DOES NOT exist`)
        addColumn1()
    } else {
        console.log(`column ${tsyms} DOES exist`)
    }
    //var result = JSON.parse(results1);
    //console.log(result);
    //var results2 = JSON.stringify(results1);
    //console.log(typeof(results2));
    //const myObj = JSON.parse(results2);
    
    //console.log(Object.values(results1));
    //for (const [key, value] of Object.entries(results2)) {
    //    console.log(`${key}: ${value}`);
    //}
    //console.log(typeof(value));

    /*
    if (results1.CNTREC === "1") {
        console.log("it is 1")
    } else {
        console.log("it is not 1")
    }
    */
}

async function addColumn1() {
    const add = db.prepare(`ALTER TABLE ${tableNew} ADD COLUMN "${tsyms}" BOOLEAN DEFAULT 0 NOT NULL CHECK (${tsyms} IN (0, 1))`)
    var results2 = add.run();
    console.log(results2);
}

async function addColumn2() {
    const add = db.prepare(`ALTER TABLE ${tableNew} ADD COLUMN '${tsyms}' BOOLEAN DEFAULT 0 NOT NULL CHECK ('${tsyms}' IN (0, 1))`)
    var result = add.run();
    console.log(result);
}




async function checkState() {
    //const check = db.prepare(`SELECT * FROM ${tableNew} WHERE ${tsyms} IS 0 LIMIT 3`); // if you use with get only gets 1, use with all gets 3
    const check = db.prepare(`SELECT symbol FROM ${tableNew} WHERE ${tsyms} IS 0`);
    let result = check.get(); // get the crypto symbol that has 0 (hasn't had an IC created yet)
    console.log(result);
    //fsyms = result.symbol;
    //console.log(fsyms);
}

async function flipState() {
    const flip = db.prepare(`UPDATE ${tableNew} SET ${tsyms} = 1 WHERE symbol = '${fsyms}'`);
    //const flip = db.prepare(`UPDATE topcrypto_tl_binance SET USD = 1 WHERE symbol = 'btc'`);
    var results7 = flip.run();
    //const checkWork = db.prepare(`SELECT * FROM ${tableNew} WHERE symbol = ${fsyms}`);
    const checkWork = db.prepare(`SELECT * FROM ${tableNew} WHERE symbol = '${fsyms}'`);
    var result8 = checkWork.all();
    console.log(result8)
}

async function checkTable() {
    const checkTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableNew}'`)
    var results11 = checkTable.get();
    console.log(results11);
    if (results11) {
        console.log(results11);
    } else {
        console.log("sorry charlie");
    }
}

async function showStuff() {
    const stmt = db.prepare(`SELECT * FROM ${tableNew} LIMIT 5`);
    var results = stmt.all();
    console.log(results);    
}


//createDB();
//showColumns();
//showStuff();
//cloneModel();
//checkColumn();
//checkColumn5();
//addColumn1()
//addColumn2()
//checkDup();
//checkState();
//flipState();
//checkTable();



/*
var datafeed = "tl_binance";
var tableO = "oracles";
var tableDF = "datafeed";
var fieldsO = "(id INTEGER PRIMARY KEY AUTOINCREMENT, oracle TEXT, jobId TEXT, fsyms TEXT, tsyms TEXT, datafeed TEXT)";
var createO = `CREATE TABLE IF NOT EXISTS ${tableDF} ${fieldsO}`;
var duplicateTable = `CREATE TABLE IF NOT EXISTS topcrypto_${datafeed} AS SELECT * FROM ${tableP}`;
const createTableO  = db.prepare(createO);
const duplicateTableP  = db.prepare(duplicateTable);
createTableO.run();
duplicateTableP.run();

//let date = new Date().toISOString()
let id = null;

await get_line('tsyms', 1, function(err, line) {
    let tsyms = line;
    //console.log(tsyms)
});

//rename column in tableP?  maybe boolean true for pair created? 
// 1. Does a column exist for the tsyms value?
//  if No, create it/rename one.
// 2. Does pair being processed already exist?
//  if Yes, stop.
// 3. Find first row in that column with bool false and use that crypto, write bool true to that column. 
//const select = db.prepare(`SELECT FROM ${table{P} WHERE }`)

// Check if column exists
const checkColumn1 = db.prepare(`SELECT COUNT(*) AS CNTREC FROM pragma_table_info('${tableP}') WHERE name='tsyms0'`);
var results1 = checkColumn1.all();
console.log(results1);

const checkTables = db.prepare(`SELECT name FROM sqlite_schema WHERE type ='table' AND name NOT LIKE 'sqlite_%'`);
var results2 = checkTables.all();
console.log(results2);
    

const alterTable = db.prepare(`ALTER TABLE ${tableP} RENAME COLUMN usd TO tsyms0`);
var results3 = alterTable.run();
console.log(results3);


const showColumns = db.prepare(`PRAGMA table_info(${tableP} )`);
var results4 = showColumns.all();
console.log(results4);



const insert = db.prepare(`INSERT INTO ${tableDF} (id, oracle, jobId, fsyms, tsyms, datafeed) VALUES (${id}, @oracle, @jobId, @fsyms, @tsyms, @datafeed)`);

const insertMany = db.transaction((feeds) => {
    for (const feed of feeds) insert.run(feed)
});

insertMany([
    { oracle: oracle, jobId: jobId, fsyms: fsyms, tsyms: tsyms, datafeed: datafeed },
]);    
*/