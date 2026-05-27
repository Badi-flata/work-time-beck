import requests
import uuid

def test_user_signup():
    email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "email": email,
        "fullName": "Test User",
        "password": "password123",
        "role": "SUPER_ADMIN",
        "phone": "0555555555"
    }
    response = requests.post("http://localhost:3030/users/logUp", json=payload)
    print("Response status:", response.status_code)
    print("Response JSON:", response.json())
    assert response.status_code == 201
    assert "token" in response.json()
    assert "user" in response.json()

if __name__ == "__main__":
    test_user_signup()