import requests
import uuid

BASE_URL = "http://localhost:3030"

def test_employee_and_manager_profile_retrieval():
    # 1. Sign up an Admin/SuperAdmin
    admin_email = f"admin_{uuid.uuid4().hex[:6]}@example.com"
    admin_payload = {
        "email": admin_email,
        "fullName": "Test Admin",
        "password": "password123",
        "role": "SUPER_ADMIN",
        "phone": "0555555550"
    }
    
    admin_reg_res = requests.post(f"{BASE_URL}/users/logUp", json=admin_payload)
    print("Admin Reg Status:", admin_reg_res.status_code)
    assert admin_reg_res.status_code == 201, "Failed to register Admin"
    admin_token = admin_reg_res.json()["token"]
    
    # 2. Fetch Admin Profile
    admin_profile_res = requests.get(
        f"{BASE_URL}/users/profile",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    print("Admin Profile Status:", admin_profile_res.status_code)
    assert admin_profile_res.status_code == 200, "Failed to fetch admin profile"
    
    admin_data = admin_profile_res.json()
    assert "user" in admin_data, "Response missing user object"
    assert "createdAt" in admin_data["user"], "Response missing createdAt for Admin user"
    assert "adminProfile" in admin_data["user"], "Response missing adminProfile for Admin"
    
    # 3. Sign up an Employee
    employee_email = f"emp_{uuid.uuid4().hex[:6]}@example.com"
    employee_payload = {
        "email": employee_email,
        "fullName": "Test Employee",
        "password": "password123",
        "role": "EMPLOYEE",
        "phone": "0555555551",
        "jobTitle": "Developer"
    }
    
    employee_reg_res = requests.post(f"{BASE_URL}/users/logUp", json=employee_payload)
    print("Employee Reg Status:", employee_reg_res.status_code)
    assert employee_reg_res.status_code == 201, "Failed to register Employee"
    employee_token = employee_reg_res.json()["token"]
    
    # 4. Fetch Employee Profile
    employee_profile_res = requests.get(
        f"{BASE_URL}/users/profile",
        headers={"Authorization": f"Bearer {employee_token}"}
    )
    print("Employee Profile Status:", employee_profile_res.status_code)
    assert employee_profile_res.status_code == 200, "Failed to fetch employee profile"
    
    employee_data = employee_profile_res.json()
    assert "user" in employee_data, "Response missing user object"
    assert "createdAt" in employee_data["user"], "Response missing createdAt for Employee user"
    assert "employeeProfile" in employee_data["user"], "Response missing employeeProfile for Employee"
    
    # Verify employee profile structure
    emp_profile = employee_data["user"]["employeeProfile"]
    assert "salary" in emp_profile, "employeeProfile missing salary"
    assert "department" in emp_profile, "employeeProfile missing department"
    assert "shift" in emp_profile, "employeeProfile missing shift"
    
    print("Success: Profiles fetched successfully and verified!")

if __name__ == "__main__":
    test_employee_and_manager_profile_retrieval()