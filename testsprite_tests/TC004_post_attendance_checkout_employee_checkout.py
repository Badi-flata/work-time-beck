import requests

BASE_URL = "http://localhost:3030"
AUTO_CHECK_ENDPOINT = "/managing/auto-check"
TIMEOUT = 30

valid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Itij2K3ZhdivINin2YTYpdiv2KfYsdmKIiwidXNlcklkIjoiNmE4ZTlkOGQtNDdlMS00ZGU2LWFlMWUtNGM1ZjFiYTJlNzk1Iiwicm9sZSI6IlNVUEVSX0FETUlOIiwiaWF0IjoxNzgyNTQ3NTgwLCJleHAiOjE3ODUxMzk1ODB9.TUxP_MILe9c6G6FTR6ATWLNlHPneoQ4-5lguMGRuPas"
expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IuKUpOKcluKcqCIsInVzZXJJZCI6IjEyMyIsInJvbGUiOiJFTVBMT1lFUiIsImlhdCI6MTYwOTAwMDAwMCwiZXhwIjoxNjA5MDAwMDAxfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"  # example expired JWT
invalid_token = "invalid.jwt.token"

def test_post_attendance_checkout_employee_checkout():
    headers_valid = {"Authorization": f"Bearer {valid_token}"}
    headers_expired = {"Authorization": f"Bearer {expired_token}"}
    headers_invalid = {"Authorization": f"Bearer {invalid_token}"}

    url = f"{BASE_URL}/attendance/check-out"

    # Test successful check-out with valid JWT token
    try:
        resp = requests.post(url, headers=headers_valid, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Expected 201 for valid token, got {resp.status_code}"
    except Exception as e:
        assert False, f"Request with valid token failed: {e}"

    # Test check-out with expired token - expect 401 or 403
    try:
        resp_expired = requests.post(url, headers=headers_expired, timeout=TIMEOUT)
        assert resp_expired.status_code in (401, 403), f"Expected 401 or 403 for expired token, got {resp_expired.status_code}"
    except Exception as e:
        assert False, f"Request with expired token failed: {e}"

    # Test check-out with invalid token - expect 401 or 403
    try:
        resp_invalid = requests.post(url, headers=headers_invalid, timeout=TIMEOUT)
        assert resp_invalid.status_code in (401, 403), f"Expected 401 or 403 for invalid token, got {resp_invalid.status_code}"
    except Exception as e:
        assert False, f"Request with invalid token failed: {e}"

test_post_attendance_checkout_employee_checkout()
