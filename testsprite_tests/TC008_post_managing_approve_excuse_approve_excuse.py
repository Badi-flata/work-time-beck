import requests

BASE_URL = "http://localhost:3030"
MANAGER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Itij2K3ZhdivINin2YTYpdiv2KfYsdmKIiwidXNlcklkIjoiNmE4ZTlkOGQtNDdlMS00ZGU2LWFlMWUtNGM1ZjFiYTJlNzk1Iiwicm9sZSI6IlNVUEVSX0FETUlOIiwiaWF0IjoxNzgyNTQ3NTgwLCJleHAiOjE3ODUxMzk1ODB9.TUxP_MILe9c6G6FTR6ATWLNlHPneoQ4-5lguMGRuPas"
HEADERS = {
    "Authorization": f"Bearer {MANAGER_TOKEN}",
    "Content-Type": "application/json"
}


def test_post_managing_approve_excuse_approve_excuse():
    # First, get pending excuses to find a valid excuse ID
    try:
        resp_pending = requests.get(
            f"{BASE_URL}/managing/pending-excuses",
            headers=HEADERS,
            timeout=30,
        )
        assert resp_pending.status_code == 200, f"Expected 200 from pending excuses, got {resp_pending.status_code}"
        pending_list = resp_pending.json()
        assert isinstance(pending_list, list), "Pending excuses response is not a list"
    except Exception as e:
        raise AssertionError(f"Failed to get pending excuses: {e}")
    
    # Prepare to test approval of a valid excuse, if available
    if pending_list:
        valid_excuse_id = pending_list[0].get("id") or pending_list[0].get("_id") or pending_list[0].get("excuseId")
        if not valid_excuse_id:
            raise AssertionError("No valid excuse ID found in the first pending excuse")
        # Approve the valid excuse
        try:
            resp_approve = requests.post(
                f"{BASE_URL}/managing/approve-excuse/{valid_excuse_id}",
                headers=HEADERS,
                timeout=30,
            )
            assert resp_approve.status_code == 201, f"Expected 201 on approving valid excuse, got {resp_approve.status_code}"
        except Exception as e:
            raise AssertionError(f"Failed to approve valid excuse: {e}")
    else:
        # No pending excuse to approve, skip approve valid excuse part
        valid_excuse_id = None

    # Test approval with a nonexistent excuse ID
    nonexistent_id = "00000000-0000-0000-0000-000000000000"
    try:
        resp_nonexistent = requests.post(
            f"{BASE_URL}/managing/approve-excuse/{nonexistent_id}",
            headers=HEADERS,
            timeout=30,
        )
        assert resp_nonexistent.status_code == 404, f"Expected 404 on approving nonexistent excuse, got {resp_nonexistent.status_code}"
    except Exception as e:
        raise AssertionError(f"Failed to get expected 404 for nonexistent excuse approval: {e}")


test_post_managing_approve_excuse_approve_excuse()