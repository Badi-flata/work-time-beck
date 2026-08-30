import requests

BASE_URL = "http://localhost:3030"
PENDING_EXCUSES_ENDPOINT = "/managing/pending-excuses"
MANAGER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Itij2K3ZhdivINin2YTYpdiv2KfYsdmKIiwidXNlcklkIjoiNmE4ZTlkOGQtNDdlMS00ZGU2LWFlMWUtNGM1ZjFiYTJlNzk1Iiwicm9sZSI6IlNVUEVSX0FETUlOIiwiaWF0IjoxNzgyNTQ3NTgwLCJleHAiOjE3ODUxMzk1ODB9.TUxP_MILe9c6G6FTR6ATWLNlHPneoQ4-5lguMGRuPas"

def test_get_managing_pending_excuses_list_excuses():
    headers_with_auth = {
        "Authorization": f"Bearer {MANAGER_TOKEN}"
    }
    headers_without_auth = {}

    # Test with valid manager JWT
    try:
        response = requests.get(
            BASE_URL + PENDING_EXCUSES_ENDPOINT,
            headers=headers_with_auth,
            timeout=30
        )
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request with valid manager JWT failed: {e}"
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    try:
        excuses_list = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"
    assert isinstance(excuses_list, list), "Expected a list of excuses"

    # Test access without manager authorization (no token)
    try:
        response_no_auth = requests.get(
            BASE_URL + PENDING_EXCUSES_ENDPOINT,
            headers=headers_without_auth,
            timeout=30
        )
    except requests.RequestException as e:
        assert False, f"Request without auth failed unexpectedly: {e}"
    assert response_no_auth.status_code in (401, 403), f"Expected 401 or 403 forbidden, got {response_no_auth.status_code}"

test_get_managing_pending_excuses_list_excuses()