const { Client } = require("pg")
require("dotenv").config();

var address;

const sleepUntil = async (f, timeoutMs) => {
    return new Promise((resolve, reject) => {
        const timeWas = new Date();
        const wait = setInterval(function() {
            if (f()) {
                console.log("resolved after", new Date() - timeWas, "ms");
                clearInterval(wait);
                resolve();
            } else if (new Date() - timeWas > timeoutMs) {
                console.log("rejected after", new Date() - timeWas, "ms");
                clearInterval(wait);
                reject();
            }
        }, 20);
    });
}

/*
try {
    await sleepUntil(() => document.querySelector('.my-selector'), 5000);
    // ready
} catch {
    // timeout
}
*/

const connectDb = async () => {
    try {
        const client = new Client({
            user: process.env.PGUSER,
            host: process.env.PGHOST,
            database: process.env.PGDATABASE,
            password: process.env.PGPASSWORD,
            port: process.env.PGPORT
        });

        await client.connect();
        
        async function buffToString() {
            const res = await client.query("SELECT * FROM eth_txes LIMIT 1");
            let rows = res.rows;

            //console.log(rows);
            console.log(rows.length);

            for ( let i = 0; i < rows.length; i++ ) {
                //console.log(rows[i].to_address);
                let buff = rows[i].to_address;
                //console.log(`0x${buff.toString('hex')}`);
                //address = (`0x${buff.toString('hex')}`);
                address = buff.toString('hex');
                console.log(address);
            }
        }

        async function strToBuf() {
            let str = "a018b48f0e9cd914a72bb45b5f2d90ed776be06f"
            console.log("Buffer.from(str): ", Buffer.from(str));
            //let buf = Buffer.from(str, 'utf8');
            //console.log(buf);
            //let hex = Buffer.from(str, 'utf8').toString('hex');
            //console.log(hex);
            //let one = Buffer.from(str).toString('hex');
            //console.log(one);
        }

        async function pollConfirm() {
            const str = "0x3c8cff68138ea70d2dec229679c6d1057ff89838";
            console.log("String :", str);
            const buffer = Buffer.from(str.substring(2,42), "hex");
            const subStr = str.substring(2,42);
            console.log("me-> ", buffer);
            console.log("me str-> ", subStr);
            console.log(typeof(buffer));
            //let one = Buffer.from(str).toString('hex');
            //console.log(one);
            const res = await client.query(`SELECT to_address FROM eth_txes WHERE state = 'confirmed'`);
            let rows = res.rows;
            if (rows) {
                console.log("found")
            } else {
                console.log("not found")
            }
            console.log("db-> ", res.rows[0].to_address);
            console.log(typeof(res.rows[0].to_address));
            
            //const res1 = await client.query(`SELECT state FROM eth_txes WHERE to_address = decode('a018b48f0e9cd914a72bb45b5f2d90ed776be06f', 'hex') LIMIT 1`);
            const res1 = await client.query(`SELECT state FROM eth_txes WHERE to_address = decode('${subStr}', 'hex') LIMIT 1`);
            //let rows1 = res1.rows;
            console.log(res1.rows[0].state);
        }

        async function pollAgain() {
            const str = "0x3c8cff68138ea70d2dec229679c6d1057ff89838";
            const subStr = str.substring(2,42);
            //const res = await client.query(`SELECT state FROM eth_txes WHERE to_address = decode('${subStr}', 'hex') LIMIT 1`);
            const res = await client.query(`SELECT state FROM eth_txes WHERE EXISTS (SELECT to_address FROM eth_txes WHERE to_address = decode('${subStr}', 'hex')) LIMIT 1`);
            let rows = res.rows;
            console.log(rows);
            console.log(rows.length);

            if (rows.length !== 0 ) {
                console.log("rows exist");
                if (rows[0].state === "confirmed") {
                    console.log("Tx confirmed! ", rows[0].state);
                    await client.end()
                } else {
                    console.log("The state is: ", rows[0].state);
                    await setTimeout(pollAgain, 1000);
                }
            } else {
                console.log("no rows yet");
                await setTimeout(pollAgain, 1000);
            }

            /*
            if (!rows.length === 0 ) {
                console.log("found");
                if ( rows[0].state === "confirmed" ) {
                    console.log("Tx confirmed! ", rows[0].state);
                    await client.end()
                } else {
                    console.log("The state is: ", rows[0].state);
                    await setTimeout(pollAgain, 1000);
                }
            } else {
                console.log("not found");
            }
            //console.log(rows);
            //console.log(res.rows[0].state);
            */
        }  

            /*
            if ( rows[0].state === "confirmed" ) {
                console.log("Tx confirmed! ", rows[0].state);
            } else {
                console.log("I'm waiting");
                setTimeout(pollConfirm, 1000);
            }
        }
            */
            /*
            if (
                

                for ( let j = 0; j < rows1.length; j++ ) {
                    console.log(rows1[j].state);
                }
            }
            */

        //await buffToString();
        //await strToBuf()
        //await pollConfirm();
        await pollAgain();

        //await client.end()

        } catch (error) {
            console.log(error)
        }
    }

connectDb()
