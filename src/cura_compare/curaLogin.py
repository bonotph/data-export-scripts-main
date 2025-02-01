# Start XLaunch in windows, disable access control
# Set DISPLAY to WSL IP address from command `ip route`

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import NoSuchElementException
import time
import pdb
import os
import traceback
import json

def wait_for_element(driver, xpath, timeout=15):
    start_time = time.time()
    while True:
        try:
            element = driver.find_element(By.XPATH, xpath)
            return element
        except NoSuchElementException:
            if time.time() - start_time > timeout:
                raise TimeoutError(f"Element with xpath '{xpath}' not found within {timeout} seconds")
        time.sleep(0.5)

def login(username: str, password: str):
    xpath = '//*[@id="usernameUserInput"]'
    username_input = wait_for_element(driver, xpath)
    username_input.clear()
    username_input.send_keys(username)

    xpath = '//*[@id="password"]'
    password_input = wait_for_element(driver, xpath)
    password_input.clear()
    password_input.send_keys(password)

    xpath = '//*[@id="loginForm"]/div[9]/div[2]/button'
    login_button = wait_for_element(driver, xpath)
    login_button.click()
    time.sleep(1.5)

workspaces = dict()
workspaces['pp'] = {
    'name': 'pp',
    'url': 'https://cura.cf-pp.genomeproject.hk/',
    'cookie_file': 'data/cura_login/cookies_pp.json',
}
workspaces['prod'] = {
    'name': 'prod',
    'url': 'https://cura.cf.genomeproject.hk/',
    'cookie_file': 'data/cura_login/cookies_prod.json',
}

driver = webdriver.Chrome()

for workspace in workspaces.values():

    cura_url = workspace['url']
    current_path = os.path.dirname(os.path.realpath(__file__))
    cookie_file = os.path.join(current_path, workspace['cookie_file'])
    credential_file = os.path.join(current_path, 'data/cura_login/credentials.txt')

    driver.get(cura_url)

    # read username and password from the first two lines of 'credentials.txt'
    with open(credential_file, 'r') as f:
        username = f.readline().strip()
        password = f.readline().strip()

    login(username, password)

    # store cookies to cookie_path/username.json
    cookies = driver.get_cookies()
    cookies = {_['name']:_['value'] for _ in cookies}
    jsonCookies = json.dumps(cookies)
    with open(cookie_file, 'w') as f:
        f.write(jsonCookies)
