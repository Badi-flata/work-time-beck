import requests

BASE_URL = "http://localhost:3030"
CHECKIN_ENDPOINT = "/attendance/check-in"
TIMEOUT = 30
VALID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Itij2K3ZhdivINin2YTYpdiv2KfYsdmKIiwidXNlcklkIjoiNmE4ZTlkOGQtNDdlMS00ZGU2LWFlMWUtNGM1ZjFiYTJlNzk1Iiwicm9sZSI6IlNVUEVSX0FETUlOIiwiaWF0IjoxNzgyNTQ3NTgwLCJleHAiOjE3ODUxMzk1ODB9.TUxP_MILe9c6G6FTR6ATWLNlHPneoQ4-5lguMGRuPas"

def test_post_attendance_checkin_employee_checkin():
    url = BASE_URL + CHECKIN_ENDPOINT

    # Test check-in with valid JWT token
    headers_auth = {
        "Authorization": f"Bearer {VALID_TOKEN}",
        "Content-Type": "application/json"
    }
    # Send empty payload as PRD does not specify required fields
    payload = {}

    response_auth = None
    try:
        response_auth = requests.post(url, json=payload, headers=headers_auth, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request with valid auth failed: {e}"

    assert response_auth is not None, "No response received for authorized check-in"
    assert response_auth.status_code == 201, f"Expected 201 for authorized check-in, got {response_auth.status_code}"

    # Test check-in without authentication token
    headers_no_auth = {
        "Content-Type": "application/json"
    }

    # For no-auth we can send empty payload to test rejection
    response_no_auth = None
    try:
        response_no_auth = requests.post(url, json={}, headers=headers_no_auth, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request without auth token failed unexpectedly: {e}"

    assert response_no_auth is not None, "No response received for unauthorized check-in"
    assert response_no_auth.status_code in (401, 403), f"Expected 401 or 403 for unauthorized check-in, got {response_no_auth.status_code}"

test_post_attendance_checkin_employee_checkin()