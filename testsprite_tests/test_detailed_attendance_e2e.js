const BASE_URL = "http://localhost:3030";
const crypto = require('crypto');

function generateRandomEmail(prefix) {
  return `${prefix}_${crypto.randomBytes(3).toString('hex')}@example.com`;
}

async function runDetailedAttendanceTests() {
  console.log("=== Starting Professional E2E Tests for Detailed Attendance & Maintenance ===");

  try {
    // 1. Sign up a Manager (SUPER_ADMIN)
    const managerEmail = generateRandomEmail("manager");
    const managerPayload = {
      email: managerEmail,
      fullName: "Manager Test User",
      password: "password123",
      role: "SUPER_ADMIN",
      phone: "0555555560"
    };

    console.log(`[Test] Registering Manager with email: ${managerEmail}...`);
    const managerRegRes = await fetch(`${BASE_URL}/users/logUp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(managerPayload)
    });

    if (managerRegRes.status !== 201) {
      const errText = await managerRegRes.text();
      throw new Error(`Failed to register Manager. Status: ${managerRegRes.status}. Error: ${errText}`);
    }

    const managerData = await managerRegRes.json();
    const managerToken = managerData.token;
    console.log("[Success] Manager registered successfully.");

    // 2. Fetch Manager Profile
    console.log("[Test] Fetching Manager Profile...");
    const managerProfileRes = await fetch(`${BASE_URL}/users/profile`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${managerToken}` }
    });

    if (managerProfileRes.status !== 200) {
      const errText = await managerProfileRes.text();
      throw new Error(`Failed to fetch manager profile. Status: ${managerProfileRes.status}. Error: ${errText}`);
    }

    const managerProfile = await managerProfileRes.json();
    if (!managerProfile.user || !managerProfile.user.adminProfile) {
      throw new Error("Manager profile response does not contain 'adminProfile'");
    }
    console.log("[Success] Manager profile structure matches database schema.");

    // 3. Sign up an Employee under this manager
    const employeeEmail = generateRandomEmail("employee");
    const employeePayload = {
      email: employeeEmail,
      fullName: "Employee E2E Test User",
      password: "password123",
      role: "EMPLOYEE",
      phone: "0555555561",
      jobTitle: "Senior Architect"
    };

    console.log(`[Test] Registering Employee with email: ${employeeEmail}...`);
    const employeeRegRes = await fetch(`${BASE_URL}/users/logUp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(employeePayload)
    });

    if (employeeRegRes.status !== 201) {
      const errText = await employeeRegRes.text();
      throw new Error(`Failed to register Employee. Status: ${employeeRegRes.status}. Error: ${errText}`);
    }

    const employeeData = await employeeRegRes.json();
    const employeeToken = employeeData.token;
    const employeeUserId = employeeData.user.id;
    console.log("[Success] Employee registered successfully.");

    // 4. Test Manager Endpoint: /managing/employee-bounded-report/:id
    const todayStr = new Date().toISOString().split('T')[0];
    console.log(`[Test] Testing Manager Endpoint: /managing/employee-bounded-report/${employeeUserId}...`);
    
    const managerEmpReportRes = await fetch(`${BASE_URL}/managing/employee-bounded-report/${employeeUserId}?startDate=${todayStr}&mode=WEEKLY`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${managerToken}` }
    });

    if (managerEmpReportRes.status !== 200) {
      const errText = await managerEmpReportRes.text();
      throw new Error(`Failed to fetch manager employee report. Status: ${managerEmpReportRes.status}. Error: ${errText}`);
    }

    const managerEmpReport = await managerEmpReportRes.json();
    if (!managerEmpReport.periodLabel || !managerEmpReport.summary || !Array.isArray(managerEmpReport.records)) {
      throw new Error("Manager employee report structure invalid");
    }
    console.log("[Success] Manager employee bounded report verified successfully.");

    // 5. Test Employee Endpoint: /attendance/bounded-period-report (Personal)
    console.log("[Test] Testing Employee Endpoint: /attendance/bounded-period-report (Personal report)...");
    const empPersonalReportRes = await fetch(`${BASE_URL}/attendance/bounded-period-report?dateAnchor=${todayStr}&mode=MONTHLY`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${employeeToken}` }
    });

    if (empPersonalReportRes.status !== 200) {
      const errText = await empPersonalReportRes.text();
      throw new Error(`Failed to fetch employee personal report. Status: ${empPersonalReportRes.status}. Error: ${errText}`);
    }

    const empPersonalReport = await empPersonalReportRes.json();
    if (!empPersonalReport.periodLabel || !empPersonalReport.summary || !Array.isArray(empPersonalReport.records)) {
      throw new Error("Employee personal report structure invalid");
    }
    console.log("[Success] Employee personal bounded report verified successfully.");

    // 6. Test AllExceptionsFilter for Structured Error Response & Trace ID
    console.log("[Test] Verifying AllExceptionsFilter with Trace ID and structured error format...");
    const errorTestRes = await fetch(`${BASE_URL}/attendance/bounded-period-report?dateAnchor=INVALID_DATE&mode=WEEKLY`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${employeeToken}` }
    });

    const errorJson = await errorTestRes.json();
    if (!errorJson.traceId || !errorJson.errorCategory) {
      console.log("Error JSON received:", errorJson);
      throw new Error("AllExceptionsFilter response does not contain 'traceId' or 'errorCategory'");
    }
    console.log(`[Success] Structured Error format verified (Trace ID: ${errorJson.traceId}, Category: ${errorJson.errorCategory}).`);

    console.log("\n=== ALL DETAILED ATTENDANCE & MAINTENANCE E2E TESTS PASSED SUCCESSFULLY! ===");
    process.exit(0);

  } catch (error) {
    console.error("\n[Error] Detailed Attendance & Maintenance Test FAILED:", error.message);
    process.exit(1);
  }
}

runDetailedAttendanceTests();
