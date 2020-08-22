const moment = require('moment');
const axios = require('axios');
const mysql = require('mysql2/promise');
var bunyan = require('bunyan');
var nodemailer = require('nodemailer');
 
// create the logger
var logger = bunyan.createLogger({
    name: 'gasPriceLogs',
    streams: [
        {
            level: 'debug',
            stream: process.stdout            // log INFO and above to stdout
          }        
    ]/* ,
    streams: [{
        type: 'rotating-file',
        path: 'gasPrice.log',
        period: '1d',   // daily rotation
        count: 3        // keep 3 back copies
    }] */
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



//Mailer config
var transporter = nodemailer.createTransport({
    sendmail: true
  });
  /* console.log(transporter); */
  

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
      //avoid inserting in DB the gas price for the same block twice.
      var [rows, fields] = await conn.execute("SELECT blocknumber FROM gasPrice WHERE blocknumber =?",[gasPriceData.blocknum]);
      logger.debug({rowsLength: rows.length}, 'Entries in Select');

      if(rows.length == 0){
        await conn.execute("INSERT INTO gasPrice (timestamp, blocknumber, fastest, fast, standard, low, blocktime, speed) VALUES (?,?,?,?,?,?,?,?)",[now,gasPriceData.blocknum,gasPriceData.fastest,gasPriceData.fast,gasPriceData.standard,gasPriceData.low,gasPriceData.blockTime,gasPriceData.speed]);
        logger.debug({TIMESTAMP: now}, 'INSERTED in DB');
        getDrop(conn, gasPriceData);
      }

    } catch (error) {
        logger.error(error);
    }
  }

async function getDrop(conn,gasPriceData){
    var [rows, fields] = await conn.execute("SELECT * FROM gasPrice ORDER BY blocknumber DESC LIMIT 2;");
    logger.debug({rowsLength: rows.length}, 'Entries in GetDrop Select');

    if(rows.length != 0){
        logger.debug({rows0Standard:rows[0].standard, rows1Standard:rows[1].standard, rows0Blocknumber:rows[0].blocknumber, rows1Blocknumber:rows[1].blocknumber}, 'Rows contents');
        var gasdelta = (rows[1].standard / rows[0].standard) * 100;
        logger.info('Standard GAS Delta in %:', gasdelta, ' GAS Drop', gasdelta-100);
        notify(gasdelta, gasPriceData);
    }
}

function notify(delta, gasPriceData){
    var mailOptions = {
        from: process.env.email,
        to: 'miguel567@gmail.com',
        subject: 'GAS Price drop '+parseInt(delta-100)+'%',
        text: 'Fast:'+gasPriceData.fast+gasPriceData.fastTime+'\n'+'Standard:'+gasPriceData.standard+gasPriceData.standardTime+'\n'+'Low:'+gasPriceData.low+gasPriceData.lowTime+'\n'+'Blocknumber:'+gasPriceData.blocknum+'\n'+'Blocktime:'+gasPriceData.blockTime+'\n'+'Speed:'+gasPriceData.speed
      };
    if(parseInt(delta-100) <= -50){
        console.log('delta',parseInt(delta-100));
        //send email
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
              logger.error(error);
            } else {
              logger.info('Email sent: ' + info.response);
            }
          });
    }else{
        if(parseInt(delta-100) <= -30){
            //send email

            transporter.sendMail(mailOptions, function(error, info){
                if (error) {
                logger.error(error);
                } else {
                logger.info('Email sent: ' + info.response);
                }
            });
    }else{
        if(parseInt(delta-100) <= -10){
            //send email

            transporter.sendMail(mailOptions, function(error, info){
                if (error) {
                logger.error(error);
                } else {
                logger.info('Email sent: ' + info.response);
                }
            });
        }
    }
    }
}

//Generate loop every X seconds to fetch data 
var requestLoop = setInterval(function(){ getGasPrice(conn)}, 10000);

