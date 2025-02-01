'use strict';

const fs = require('node:fs');
const path = require('path');
const axios = require('axios');

require('dotenv').config();

const START = './src';

function recursiveLS(filePath) {
  const files = [];

  fs.readdirSync(path.resolve(filePath)).forEach((file) => {
    const subPath = path.join(filePath, file);
    const fileStat = fs.statSync(subPath);

    files.push({ file: subPath, mtime: fileStat.mtime });

    if (fileStat.isDirectory()) {
      files.push(...recursiveLS(subPath));
    }
  });

  return files;
}

async function testLambda() {
  const start = Date.now();

  const result = await axios.get(process.env.VARAPP_LAMBDA_API_LINK, {
    headers: {
      'X-API-Key': process.env.VARAPP_LAMBDA_API_KEY,
    },
  });

  console.log(result);
  console.log(result.data);

  console.log(
    result.data
      .map(({ file, mtime }) => ({ file, mtime: new Date(mtime) }))
      .sort((a, b) => a.mtime - b.mtime),
  );
  console.log('elapsed: ' + (Date.now() - start) + 'ms');
  console.log(result.data.length);
}

async function main() {
  // const result = recursiveLS(START);
  // console.log(result);
  // console.log(result.length);
  await testLambda();
}

main();
