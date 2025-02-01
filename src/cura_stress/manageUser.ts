import { readFileSync } from 'fs';
const cookie = JSON.parse(
  readFileSync('src/cura_compare/cookie.json', 'utf8'),
) as {
  commonAuthId: string;
  'hkgi-sso-auth_pp': string;
};

interface User {
  id: string;
  display_name: string;
  user_name: string;
  email: string;
}

async function searchUser(key: string) {
  const response = await fetch(
    `https://auth.api.cf-pp.genomeproject.hk/users?sort=id&page=1&per-page=20&filter[or][][display_name][like]=${key}&filter[or][][user_name][like]=${key}&filter[or][][email][like]=${key}`,
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
        cookie: `commonAuthId=${cookie.commonAuthId}; hkgi-sso-auth_pp=${cookie['hkgi-sso-auth_pp']};`,
        Referer: 'https://admin.cf-pp.genomeproject.hk/',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
      body: null,
      method: 'GET',
    },
  );
  const result = (await response.json()) as {
    items: User[];
  };
  if (result.items.length === 0) {
    console.log(`${key} : No user found`);
    return;
  } else {
    return result.items[0];
  }
}

async function assignRole(user: User) {
  const response = await fetch(
    'https://auth.api.cf-pp.genomeproject.hk/role-assignments',
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
        cookie: `hkgi-sso-auth_pp=${cookie['hkgi-sso-auth_pp']}; commonAuthId=${cookie.commonAuthId};`,
        Referer: 'https://admin.cf-pp.genomeproject.hk/',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
      body: `{"assignee_id":"${user.id}","role_id":"hkgi_curator","resource_type":"cura","resource_id":"cura"}`,
      method: 'POST',
    },
  );
  // get response status
  console.log(user.user_name, ':', response.status);
}

async function main() {
  for (let i = 1; i <= 20; i++) {
    const index = i.toString().padStart(2, '0');
    const user = await searchUser(`curatest${index}`);
    if (user) assignRole(user);
  }
}

main();
