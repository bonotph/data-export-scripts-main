import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import fs from 'fs';
import { stringify } from 'csv-stringify/sync';
import util from 'util';
import cors from 'cors';
import { main as clinicalSummary } from './clinicalSummary/index.js';
import { main as hpo_family } from './hpo_family/index.js';
import * as XLSX from "xlsx"
import XlsxPopulate from 'xlsx-populate';
import { authenticateKey } from './auth/authKey.js';
import { authenticator } from './auth/authenticator.js';
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.CONVERTER_PORT || 8000;
app.listen(PORT, () => {
  console.log("Server Listening on PORT:", PORT);
});

function addDays(dateString) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 1); 

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); 
  const day = String(date.getDate()).padStart(2, '0');

  let newDate = `${year}-${month}-${day}`;
  return newDate;
}

const getToday = () => {
  var today = new Date();
  let dd = String(today.getDate()).padStart(2, '0');
  let mm = String(today.getMonth() + 1).padStart(2, '0'); 
  let yyyy = today.getFullYear();
  today = yyyy+"-"+mm+"-"+dd;
  return today;
}

app.post('/auth/login', async(req,res)=>{
  await authenticator(req,res);
});

app.post('/convert-to-csv', authenticateKey, async (req, res) => {
  console.log("/convert-to-csv start");
  const file = req.body.name;
  const filedate = req.body.csvdate;
  const inclusive = req.body.inclusive;
  const type = req.body.filetype;
  const encrypt = req.body.encryptFile;
  console.log('include?' + inclusive);
  var newDate;
  if(inclusive){
    newDate = addDays(filedate);
  }
  if (!file) {
    return res.status(400).send('Invalid file');
  }
  else if(file.split('_')[0]==='cf'){
    SHConvertToCSV(file, res, newDate||filedate, encrypt)
    .then(() => {
      console.log('Conversion completed');
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send('Error converting to XLSX');
    });

  }
  else{
  SQLConvertToCSV(file, res, newDate||filedate, type, encrypt)
    .then(() => {
      console.log('Conversion completed');
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send('Error converting to CSV');
    });
  }
});






async function SHConvertToCSV(file, res, filedate, encrypt){
  try {
    var result;
    if (file === 'cf_clinical_summary') {
      result = await clinicalSummary(filedate);
    } else if (file === 'cf_hpo_family') {
      result = await hpo_family(filedate);
    }

    //encrypt
    if (result) {
      if (encrypt) {
        let resultCopy = await XlsxPopulate.fromDataAsync(result)
        result = await resultCopy.outputAsync({
              password: process.env.XLSXPassword || `data_export_${getToday().replaceAll("-", "").substring(2)}`
            })
          .catch(error => {
            console.error('Error encrypting file:', error);
            res.status(500).send('Error encrypting file');
          });
      } 
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${file}.xlsx`);
        res.status(200).send(result);
    
    } else {
      res.status(404).send('No data found');
      return;
    }
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
    return;
  }
}





async function SQLConvertToCSV(file, res, filedate, filetype, encrypt) {
  console.log('date: ' + filedate);
  var connection;
  const sqlPath = './sqlfile/' + `${file}.sql`;

  try {
    // connect database
    try{
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      port: process.env.DB_PORT,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      namedPlaceholders: true,
    })}catch(err){
      res.status(511).send('Unable to connect to server');
      return;
    };

    // read sql queries
    const sql = await util.promisify(fs.readFile)(sqlPath, 'utf8');

    // remove comments from sql queries
    const cleanedSql = sql.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '');

    // split to separate statements
    const statements = cleanedSql.split(/;\s*$/m).filter(stmt => stmt.trim() !== '');

    let csvString = '';
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Hong_Kong',
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
  })
    const formatDate = (date) => {
      return formatter.format(date).replace('T', ' ').slice(0, 19);
    };
    try{
  // USE analytic
    await connection.query('USE analytic');
    // execute statements
    var [results, fields] = await connection.execute(statements.join(';'), [`${filedate}`,]); 
    }catch(err){
      console.log(err);
      res.status(500).send('Query error:', err);
      return;
    }

    try{
    if (results.length > 0) {
      if(filetype){
        // convert to xlsx
        const header = fields.map(field => field.name);
        const data = [header, ...results.map(Object.values)];   
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        var buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        //encrypt
      if (encrypt) {
        let bufferCopy = await XlsxPopulate.fromDataAsync(buffer)
        buffer = await bufferCopy.outputAsync({
              password: process.env.XLSXPassword || `data_export_${getToday().replaceAll("-", "").substring(2)}`,
              type: 'nodebuffer'
            })
          .catch(error => {
            console.error('Error encrypting file:', error);
            res.status(500).send('Error encrypting file');
          });
      } 
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${file}.xlsx`);
        res.status(200).send(buffer);

      }else{
        //convert to csv
        const header = fields.map(field => field.name);
        csvString = stringify([header, ...results.map(Object.values)], {cast: { date: function (value) {return formatDate(value);}}});
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${file}.csv`);
        res.status(200).send(csvString);
        return; 
      }

    } else {
      res.status(204).send('No data to write to CSV');
      return;
    }
  }catch(err){
    res.status(204).send('convert error:', err);
    console.log('convert error:', err);
    return;
  }


  } catch (err) {
    console.error(err);
    res.status(500).send(err);
    return;
  } finally {
    if (connection) {
      await connection.end();
      return;
    }
  }
}

