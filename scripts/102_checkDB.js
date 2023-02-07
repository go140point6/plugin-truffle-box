const Database = require('better-sqlite3');
//const fs = require('fs');

const db = new Database('data/data.db', {verbose: console.log });

var tableMain = "main";
var tableNew = "topcrypto_tl_binance"

checkTableMain();
checkTableNew();

async function checkTableMain() {
    let checkWork = db.prepare(`SELECT * FROM ${tableMain} LIMIT 10`);
    let result = checkWork.all();
    console.log(result)
    }

async function checkTableNew() {
    let checkWork = db.prepare(`SELECT * FROM ${tableNew} LIMIT 10`);
    let result = checkWork.all();
    console.log(result)
}