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

def logout():
    xpath = '//*[@id="root"]/div/header/div/div[2]/button'
    logout_button = wait_for_element(driver, xpath)
    logout_button.click()
    time.sleep(1)

    xpath = '//*[@id="root"]/div/form/div/button'
    relogin_button = wait_for_element(driver, xpath)
    relogin_button.click()

cura_url = 'https://cura.cf-pp.genomeproject.hk/'
current_path = os.path.dirname(os.path.realpath(__file__))
cookie_path = os.path.join(current_path, 'cookies')

driver = webdriver.Chrome()

driver.get(cura_url)

try:
    for index in range(0, 20):
        username = 'curatest' + str(index+1).zfill(2)
        password = 'VXrHq*zDs8^@m'

        login(username, password)

        # store cookies to cookie_path/username.json
        cookies = driver.get_cookies()
        cookies = {_['name']:_['value'] for _ in cookies}
        jsonCookies = json.dumps(cookies)
        cookie_filename = os.path.join(cookie_path, f'{username}.json')
        with open(cookie_filename, 'w') as f:
            f.write(jsonCookies)

        logout()
except:
    traceback.print_exc()
    pdb.set_trace()