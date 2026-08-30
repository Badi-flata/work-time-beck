import requests

BASE_URL = "http://localhost:3030"
ATTENDANCE_SHIFT_PATH = "/attendance/shift"
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Itij2K3ZhdivINin2YTYpdiv2KfYsdmKIiwidXNlcklkIjoiNmE4ZTlkOGQtNDdlMS00ZGU2LWFlMWUtNGM1ZjFiYTJlNzk1Iiwicm9sZSI6IlNVUEVSX0FETUlOIiwiaWF0IjoxNzgyNTQ3NTgwLCJleHAiOjE3ODUxMzk1ODB9.TUxP_MILe9c6G6FTR6ATWLNlHPneoQ4-5lguMGRuPas"
HEADERS_AUTH = {
    "Authorization": f"Bearer {AUTH_TOKEN}"
}

def test_get_attendance_shift():
    # Test with valid JWT token
    try:
        response = requests.get(
            f"{BASE_URL}{ATTENDANCE_SHIFT_PATH}",
            headers=HEADERS_AUTH,
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        json_data = response.json()
        assert isinstance(json_data, (dict, list)), "Response JSON should be a dict or list with shift data"
        # Additional checks could be added here based on expected shift data schema
    except requests.RequestException as e:
        assert False, f"Request with valid token failed: {e}"

    # Test without authentication token
    try:
        response_no_auth = requests.get(
            f"{BASE_URL}{ATTENDANCE_SHIFT_PATH}",
            timeout=30
        )
        assert response_no_auth.status_code in (401, 403), f"Expected 401 or 403, got {response_no_auth.status_code}"
        error_data = response_no_auth.json()
        assert "error" in error_data or "message" in error_data, "Error response should contain error or message"
    except requests.RequestException as e:
        assert False, f"Request without token failed: {e}"

test_get_attendance_shift()