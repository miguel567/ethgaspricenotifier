const moment = require('moment');
const axios = require('axios');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const result = dotenv.config();
var bunyan = require('bunyan');
 
// create the logger
var logger = bunyan.createLogger({
    name: 'gasPriceLogs',
    streams: [
        {
            level: 'debug',
            stream: process.stdout            // log INFO and above to stdout
          }        
    ],
});

if (result.error) {
  throw result.error;
}


// Connect to DB
let conn;

mysql.createConnection({   
    host: process.env.host, 
    user: process.env.user, 
    password: process.env.password, 
    database: process.env.database
    }).then((val,err) =>{
        if (!err){
            conn = val;
            logger.debug(conn);
            logger.info('connected to DB');
  
        } else {logger.error(err);}
    });

//Fetch Gas Price Data
async function getGasPrice (conn){
    try {
      const response = await axios.get('https://data-api.defipulse.com/api/v1/egs/api/ethgasAPI.json?api-key=' + process.env.GASSTATION_API_KEY)
      var gasPriceData = {
          fastest: response.data.fastest/10,
          fast:  response.data.fast/10,
          low:  response.data.safeLow/10,
          standard:  response.data.average/10,
          speed:  response.data.speed,
          blockTime:  response.data.block_time,
          blocknum:  response.data.blockNum,
          fastTime: '<2m',
          standardTime: '<5m',
          lowTime: '<30m'
      };
      logger.info({Fast: gasPriceData.fast + gasPriceData.fastTime, Standard: gasPriceData.standard + gasPriceData.standardTime, Low: gasPriceData.low + gasPriceData.lowTime, Fastest: gasPriceData.fastest, BlockNumber: gasPriceData.blocknum, BlockTime: gasPriceData.blockTime, Speed: gasPriceData.speed});
      //Inser price in DB
      var now = moment().format('YYYY-MM-DD HH:mm:ss');
      await conn.execute("INSERT INTO gasPrice (timestamp, blocknumber, fastest, fast, standard, low, blocktime, speed) VALUES (?,?,?,?,?,?,?,?)",[now,gasPriceData.blocknum,gasPriceData.fastest,gasPriceData.fast,gasPriceData.standard,gasPriceData.low,gasPriceData.blockTime,gasPriceData.speed]);
      logger.debug({TIMESTAMP: now}, 'INSERTED in DB');
    } catch (error) {
        logger.error(error);
    }
  }

//Generate loop every X seconds to fetch data 
var requestLoop = setInterval(function(){ getGasPrice(conn)}, 20000);

