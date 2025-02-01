import axios from 'axios';
import fs from 'node:fs/promises';

require('dotenv').config();

const VARAPP_LAMBDA_API_LINK = process.env.VARAPP_LAMBDA_API_LINK as string;
const VARAPP_LAMBDA_API_KEY = process.env.VARAPP_LAMBDA_API_KEY as string;

async function main() {
  const response = await axios.get<any[]>(VARAPP_LAMBDA_API_LINK, {
    headers: {
      'X-API-Key': VARAPP_LAMBDA_API_KEY,
    },
  });

  console.log(response.data.length);

  await fs.writeFile(
    `${__dirname}/input_data/varapp_data.json`,
    JSON.stringify(response.data),
  );
}

if (require.main === module) {
  main();
}
