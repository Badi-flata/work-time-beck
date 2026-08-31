import requests

BASE_URL = "http://localhost:3030"
LOGUP_ENDPOINT = "/users/logUp"
LOGIN_ENDPOINT = "/users/loginIn"
TIMEOUT = 30

def test_post_users_logup_user_registration():
    # Valid user registration data
    valid_user = {
        "username": "testuser123",
        "email": "testuser123@example.com",
        "password": "StrongPass!123"
    }
    headers = {"Content-Type": "application/json"}

    # 1. Test registration with valid data
    response = requests.post(
        f"{BASE_URL}{LOGUP_ENDPOINT}",
        json=valid_user,
        headers=headers,
        timeout=TIMEOUT
    )
    assert response.status_code == 201, f"Expected 201, got {response.status_code}"

    # 2. Test registration with missing username (invalid data)
    invalid_user_missing_username = {
        "email": "missingusername@example.com",
        "password": "StrongPass!123"
    }
    response_missing_username = requests.post(
        f"{BASE_URL}{LOGUP_ENDPOINT}",
        json=invalid_user_missing_username,
        headers=headers,
        timeout=TIMEOUT
    )
    assert 400 <= response_missing_username.status_code < 500, \
        f"Expected client error for missing username, got {response_missing_username.status_code}"

    # 3. Test registration with invalid email format
    invalid_user_invalid_email = {
        "username": "userwithbademail",
        "email": "not-an-email",
        "password": "StrongPass!123"
    }
    response_invalid_email = requests.post(
        f"{BASE_URL}{LOGUP_ENDPOINT}",
        json=invalid_user_invalid_email,
        headers=headers,
        timeout=TIMEOUT
    )
    assert 400 <= response_invalid_email.status_code < 500, \
        f"Expected client error for invalid email, got {response_invalid_email.status_code}"

    # 4. Test registration with missing password
    invalid_user_missing_password = {
        "username": "usernopassword",
        "email": "usernopassword@example.com"
    }
    response_missing_password = requests.post(
        f"{BASE_URL}{LOGUP_ENDPOINT}",
        json=invalid_user_missing_password,
        headers=headers,
        timeout=TIMEOUT
    )
    assert 400 <= response_missing_password.status_code < 500, \
        f"Expected client error for missing password, got {response_missing_password.status_code}"

    # 5. Test login with valid credentials of the successfully created user
    login_payload = {
        "username": valid_user["username"],
        "password": valid_user["password"]
    }
    login_response = requests.post(
        f"{BASE_URL}{LOGIN_ENDPOINT}",
        json=login_payload,
        headers=headers,
        timeout=TIMEOUT
    )
    assert login_response.status_code == 201, f"Expected 201 on login, got {login_response.status_code}"
    login_json = login_response.json()
    assert "token" in login_json, "Token missing in login response"
    assert "user" in login_json, "User data missing in login response"

    # 6. Test login with invalid credentials
    invalid_login_payload = {
        "username": "nonexistentuser",
        "password": "wrongpassword"
    }
    invalid_login_response = requests.post(
        f"{BASE_URL}{LOGIN_ENDPOINT}",
        json=invalid_login_payload,
        headers=headers,
        timeout=TIMEOUT
    )
    assert 400 <= invalid_login_response.status_code < 500, \
        f"Expected authentication failure status, got {invalid_login_response.status_code}"

test_post_users_logup_user_registration()