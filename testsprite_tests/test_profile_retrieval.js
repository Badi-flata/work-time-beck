const BASE_URL = "http://localhost:3030";
const crypto = require('crypto');

function generateRandomEmail(prefix) {
  return `${prefix}_${crypto.randomBytes(3).toString('hex')}@example.com`;
}

async function runTests() {
  console.log("Starting E2E Profile Retrieval Tests...");

  try {
    // 1. Sign up an Admin/SuperAdmin
    const adminEmail = generateRandomEmail("admin");
    const adminPayload = {
      email: adminEmail,
      fullName: "Test Admin",
      password: "password123",
      role: "SUPER_ADMIN",
      phone: "0555555550"
    };

    console.log(`Registering Admin with email: ${adminEmail}`);
    const adminRegRes = await fetch(`${BASE_URL}/users/logUp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminPayload)
    });

    if (adminRegRes.status !== 201) {
      const errorText = await adminRegRes.text();
      throw new Error(`Failed to register Admin. Status: ${adminRegRes.status}. Error: ${errorText}`);
    }

    const adminRegData = await adminRegRes.json();
    const adminToken = adminRegData.token;
    console.log("Admin registered successfully.");

    // 2. Fetch Admin Profile
    console.log("Fetching Admin Profile...");
    const adminProfileRes = await fetch(`${BASE_URL}/users/profile`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });

    if (adminProfileRes.status !== 200) {
      const errorText = await adminProfileRes.text();
      throw new Error(`Failed to fetch admin profile. Status: ${adminProfileRes.status}. Error: ${errorText}`);
    }

    const adminData = await adminProfileRes.json();
    if (!adminData.user) throw new Error("Admin response missing 'user' object");
    if (!adminData.user.createdAt) throw new Error("Admin response missing 'createdAt' inside user");
    if (!adminData.user.adminProfile) throw new Error("Admin response missing 'adminProfile'");
    
    console.log("Admin Profile verified successfully: 'createdAt' and 'adminProfile' are present.");

    // 3. Sign up an Employee
    const employeeEmail = generateRandomEmail("emp");
    const employeePayload = {
      email: employeeEmail,
      fullName: "Test Employee",
      password: "password123",
      role: "EMPLOYEE",
      phone: "0555555551",
      jobTitle: "Developer"
    };

    console.log(`Registering Employee with email: ${employeeEmail}`);
    const employeeRegRes = await fetch(`${BASE_URL}/users/logUp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(employeePayload)
    });

    if (employeeRegRes.status !== 201) {
      const errorText = await employeeRegRes.text();
      throw new Error(`Failed to register Employee. Status: ${employeeRegRes.status}. Error: ${errorText}`);
    }

    const employeeRegData = await employeeRegRes.json();
    const employeeToken = employeeRegData.token;
    console.log("Employee registered successfully.");

    // 4. Fetch Employee Profile
    console.log("Fetching Employee Profile...");
    const employeeProfileRes = await fetch(`${BASE_URL}/users/profile`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${employeeToken}` }
    });

    if (employeeProfileRes.status !== 200) {
      const errorText = await employeeProfileRes.text();
      throw new Error(`Failed to fetch employee profile. Status: ${employeeProfileRes.status}. Error: ${errorText}`);
    }

    const employeeData = await employeeProfileRes.json();
    if (!employeeData.user) throw new Error("Employee response missing 'user' object");
    if (!employeeData.user.createdAt) throw new Error("Employee response missing 'createdAt' inside user");
    if (!employeeData.user.employeeProfile) throw new Error("Employee response missing 'employeeProfile'");
    
    const empProfile = employeeData.user.employeeProfile;
    if (empProfile.salary === undefined) throw new Error("employeeProfile missing 'salary'");
    if (!empProfile.department) throw new Error("employeeProfile missing 'department'");
    if (!empProfile.shift) throw new Error("employeeProfile missing 'shift'");

    console.log("Employee Profile verified successfully: 'createdAt', 'salary', 'department', and 'shift' are present.");
    console.log("All E2E profile retrieval tests PASSED successfully!");
    process.exit(0);

  } catch (error) {
    console.error("Test failed:", error.message);
    process.exit(1);
  }
}

runTests();
