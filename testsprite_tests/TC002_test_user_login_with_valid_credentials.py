import requests

def test_login():
    payload = {
        "email": "manager@example.com",
        "password": "password123"
    }
    response = requests.post("http://localhost:3030/users/loginIn", json=payload)
    print("Response status:", response.status_code)
    assert response.status_code == 201
    assert "token" in response.json()
    assert "user" in response.json()

if __name__ == "__main__":
    test_login()