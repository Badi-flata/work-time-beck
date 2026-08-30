import requests

BASE_URL = "http://localhost:3030"
LOGIN_ENDPOINT = "/users/loginIn"
TIMEOUT = 30

def test_post_users_loginin_user_login():
    url = BASE_URL + LOGIN_ENDPOINT
    headers = {"Content-Type": "application/json"}

    # Valid login credentials (adjusted to use 'username' as field)
    valid_payload = {
        "username": "validuser@example.com",
        "password": "ValidPassword123"
    }

    # Invalid login credentials
    invalid_payload = {
        "username": "invaliduser@example.com",
        "password": "WrongPassword"
    }

    # Test valid login attempt
    try:
        valid_response = requests.post(url, json=valid_payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Valid login request failed with exception: {e}"

    assert valid_response.status_code == 201, f"Expected 201 for valid login, got {valid_response.status_code}"
    valid_json = None
    try:
        valid_json = valid_response.json()
    except ValueError:
        assert False, "Response is not valid JSON on valid login"

    assert "token" in valid_json, "Response JSON missing 'token' on valid login"
    assert "user" in valid_json, "Response JSON missing 'user' on valid login"
    assert isinstance(valid_json["token"], str) and valid_json["token"], "'token' should be a non-empty string"
    assert isinstance(valid_json["user"], dict) and valid_json["user"], "'user' should be a non-empty dict"

    # Test invalid login attempt
    try:
        invalid_response = requests.post(url, json=invalid_payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Invalid login request failed with exception: {e}"

    # Based on typical authentication failure, expect 401 Unauthorized or 400 Bad Request
    assert invalid_response.status_code in (400, 401), f"Expected 400 or 401 for invalid login, got {invalid_response.status_code}"

    # Optional: check error message presence in response
    try:
        invalid_json = invalid_response.json()
        assert ("error" in invalid_json) or ("message" in invalid_json) or ("detail" in invalid_json), \
            "Error response should contain error or message field"
    except ValueError:
        # JSON may not be present, just pass
        pass

test_post_users_loginin_user_login()
