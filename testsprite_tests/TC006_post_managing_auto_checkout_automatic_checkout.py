import requests

BASE_URL = "http://localhost:3030"
AUTO_CHECKOUT_ENDPOINT = "/managing/auto-check"
TIMEOUT = 30

VALID_MANAGER_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Itij2K3ZhdivINin2YTYpdiv2KfYsdmKIiwidXNlcklkIjoiNmE4ZTlkOGQtNDdlMS00ZGU2LWFlMWUtNGM1ZjFiYTJlNzk1Iiwicm9sZSI6IlNVUEVSX0FETUlOIiwiaWF0IjoxNzgyNTQ3NTgwLCJleHAiOjE3ODUxMzk1ODB9.TUxP_MILe9c6G6FTR6ATWLNlHPneoQ4-5lguMGRuPas"
INVALID_JWT = "invalid.token.value"

def test_post_managing_auto_checkout_automatic_checkout():
    headers_valid = {
        "Authorization": f"Bearer {VALID_MANAGER_JWT}",
        "Content-Type": "application/json"
    }
    headers_invalid = {
        "Authorization": f"Bearer {INVALID_JWT}",
        "Content-Type": "application/json"
    }

    # Test with valid manager JWT
    try:
        response_valid = requests.post(
            f"{BASE_URL}{AUTO_CHECKOUT_ENDPOINT}",
            headers=headers_valid,
            timeout=TIMEOUT
        )
    except requests.RequestException as e:
        assert False, f"Request with valid token failed due to exception: {e}"

    assert response_valid.status_code == 201, (
        f"Expected status code 201 for valid token, got {response_valid.status_code}. "
        f"Response body: {response_valid.text}"
    )

    # Test with invalid JWT token
    try:
        response_invalid = requests.post(
            f"{BASE_URL}{AUTO_CHECKOUT_ENDPOINT}",
            headers=headers_invalid,
            timeout=TIMEOUT
        )
    except requests.RequestException as e:
        assert False, f"Request with invalid token failed due to exception: {e}"

    assert response_invalid.status_code in (401, 403), (
        f"Expected status code 401 or 403 for invalid token, got {response_invalid.status_code}. "
        f"Response body: {response_invalid.text}"
    )

test_post_managing_auto_checkout_automatic_checkout()