import { readFileSync } from 'fs';
interface cookieType {
  commonAuthId: string;
  'hkgi-sso-auth_pp': string;
}
interface sampleType {
  id: string;
}

async function list_samples(cookie: cookieType) {
  const response = await fetch(
    'https://cura.api.cf-pp.genomeproject.hk/interpretation/list?searchText=&page=0&pageSize=50',
    {
      headers: {
        accept: '*/*',
        'accept-language': 'zh,zh-TW;q=0.9',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        'sec-ch-ua':
          '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        cookie: `commonAuthId=${cookie.commonAuthId}; hkgi-sso-auth_pp=${cookie['hkgi-sso-auth_pp']}`,
        Referer: 'https://cura.cf-pp.genomeproject.hk/',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
      body: null,
      method: 'POST',
    },
  );
  // throw error if response is not ok
  if (!response.ok) {
    throw new Error('response not ok');
  }

  const result = (await response.json()) as {
    data: sampleType[];
  };
  return result.data;
}

async function check_samples(cookie: cookieType, id: string) {
  const response = await fetch(
    'https://cura.api.cf-pp.genomeproject.hk/variant?id=87b43b54-3152-46e0-8dde-31dc139d12c2',
    {
      headers: {
        accept: '*/*',
        'accept-language': 'zh,zh-TW;q=0.9',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        pragma: 'no-cache',
        'sec-ch-ua':
          '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        cookie: `commonAuthId=${cookie.commonAuthId}; hkgi-sso-auth_pp=${cookie['hkgi-sso-auth_pp']}`,
        Referer: 'https://cura.cf-pp.genomeproject.hk/',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
      body: `{"id":"${id}","page":"0","pageSize":"200","filter":{},"sort":""}`,
      method: 'POST',
    },
  );
  // throw error if response is not ok
  if (!response.ok) {
    throw new Error('response not ok');
  }
}

async function testUser(username: string) {
  const cookie: cookieType = JSON.parse(
    readFileSync(`src/cura_compare/cookies/${username}.json`, 'utf8'),
  );
  const samples = await list_samples(cookie);

  // choose a random id
  const random_id = samples[Math.floor(Math.random() * samples.length)].id;
  await check_samples(cookie, random_id);
  console.log(`User ${username} passed`);
}

async function main() {
  var promises = [];
  for (let i = 1; i <= 20; i++) {
    const index = i.toString().padStart(2, '0');
    const username = `curatest${index}`;
    promises.push(testUser(username));
  }

  await Promise.all(promises);
}

main();
