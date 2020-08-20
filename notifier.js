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


async function getGasPrice (){
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
      logger.info({Fast: gasPriceData.fast + gasPriceData.fastTime, Standard: gasPriceData.standard + gasPriceData.standardTime, Low: gasPriceData.low + gasPriceData.lowTime, Fastest: gasPriceData.fastest, BlockNumber: gasPriceData.blocknum, BlockTime: gasPriceData.blocktime, Speed: gasPriceData.speed});

    } catch (error) {
        logger.error(error.response.body);
    }
  }

  var requestLoop = setInterval(function(){ getGasPrice()}, 3000);

