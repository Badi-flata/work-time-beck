const BASE_URL = "http://localhost:3030";
const crypto = require('crypto');

function generateRandomEmail(prefix) {
  return `${prefix}_${crypto.randomBytes(3).toString('hex')}@example.com`;
}

async function runDirectorySearchE2ETests() {
  console.log("=== Starting Comprehensive E2E Tests for Employees Directory & Employee Assignment ===");

  try {
    // 1. Register Manager A (SUPER_ADMIN)
    const managerEmail = generateRandomEmail("dir_manager_a");
    console.log(`[Test] Registering Manager A with email: ${managerEmail}...`);
    const managerRegRes = await fetch(`${BASE_URL}/users/logUp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: managerEmail,
        fullName: "Director Khalid Al-Otaibi",
        password: "password123",
        role: "SUPER_ADMIN",
        phone: "0555551122"
      })
    });

    if (managerRegRes.status !== 201) {
      const err = await managerRegRes.text();
      throw new Error(`Failed to register Manager A: ${err}`);
    }

    const managerData = await managerRegRes.json();
    const managerToken = managerData.token;
    console.log("[Success] Manager A registered.");

    // 2. Manager A creates a Department and Shift
    console.log("[Test] Creating Department 'Digital Marketing' for Manager A...");
    const createDeptRes = await fetch(`${BASE_URL}/department`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        name: `Marketing_${crypto.randomBytes(2).toString('hex')}`,
        description: "Growth and digital marketing team"
      })
    });

    if (createDeptRes.status !== 201) {
      throw new Error(`Failed to create department: ${await createDeptRes.text()}`);
    }
    const deptData = await createDeptRes.json();
    const deptId = deptData.department.id;

    console.log("[Test] Creating Shift 'Marketing Shift'...");
    const createShiftRes = await fetch(`${BASE_URL}/department/shifts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        name: "Morning Marketing",
        startTime: "09:00",
        endTime: "17:00",
        departmentsId: deptId
      })
    });

    if (createShiftRes.status !== 201) {
      throw new Error(`Failed to create shift: ${await createShiftRes.text()}`);
    }
    const shiftData = await createShiftRes.json();
    const shiftId = shiftData.shift.id;

    // 3. Register a New Employee (Employee B)
    const employeeEmail = generateRandomEmail("dir_emp_b");
    const employeeName = "Tariq Abdulaziz Mansour";
    console.log(`[Test] Registering New Employee B (${employeeEmail})...`);
    const empRegRes = await fetch(`${BASE_URL}/users/logUp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: employeeEmail,
        fullName: employeeName,
        password: "password123",
        role: "EMPLOYEE",
        jobTitle: "Content Creator",
        phone: "0555553344"
      })
    });

    if (empRegRes.status !== 201) {
      throw new Error(`Failed to register Employee B: ${await empRegRes.text()}`);
    }
    const empData = await empRegRes.json();
    const employeeUserId = empData.user.id;
    console.log(`[Success] Employee B created with User ID: ${employeeUserId}`);

    // 4. Verify Employee B is NOT automatically linked to any manager
    console.log("[Test] Verifying Employee B is unassigned (managerId == null) in directory search...");
    const searchRes = await fetch(`${BASE_URL}/users/search_Word?search_Word=${encodeURIComponent("Tariq")}&role=EMPLOYEE`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${managerToken}` }
    });

    if (searchRes.status !== 200) {
      throw new Error(`Failed to search directory: ${await searchRes.text()}`);
    }
    const searchData = await searchRes.json();
    const foundEmp = searchData.data.find(u => u.id === employeeUserId);
    if (!foundEmp) throw new Error("Employee B not found in search results");

    if (foundEmp.employeeProfile?.managerId !== null && foundEmp.employeeProfile?.managerId !== undefined) {
      throw new Error(`Employee B was incorrectly auto-linked to managerId: ${foundEmp.employeeProfile?.managerId}`);
    }
    console.log("[Success] Confirmed: Employee B is completely unassigned (managerId is null) upon creation.");

    // 5. Test Role Filtering in Directory Search
    console.log("[Test] Testing role filters in directory search (EMPLOYEE vs MANAGER)...");
    const empFilterRes = await fetch(`${BASE_URL}/users/search_Word?role=EMPLOYEE`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${managerToken}` }
    });
    const empFilterData = await empFilterRes.json();
    if (!empFilterData.data.every(u => u.role === 'EMPLOYEE')) {
      throw new Error("EMPLOYEE filter returned non-employee users");
    }

    const mgrFilterRes = await fetch(`${BASE_URL}/users/search_Word?role=SUPER_ADMIN`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${managerToken}` }
    });
    const mgrFilterData = await mgrFilterRes.json();
    if (!mgrFilterData.data.some(u => u.id === managerData.user.id)) {
      throw new Error("Manager A not found in manager filter search");
    }
    console.log("[Success] Role filter queries verified.");

    // 6. Manager A Assigns/Claims Employee B with Department, Shift, and Salary
    console.log("[Test] Manager A assigning Employee B with custom Department, Shift, and Salary: 8500 SAR...");
    const assignRes = await fetch(`${BASE_URL}/managing/add-employee/${employeeUserId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        departmentId: deptId,
        shiftId: shiftId,
        salary: 8500
      })
    });

    if (assignRes.status !== 201) {
      throw new Error(`Failed to assign employee: ${await assignRes.text()}`);
    }
    const assignData = await assignRes.json();
    console.log(`[Success] Employee assigned successfully: ${assignData.message}`);

    // 7. Verify Employee B is now assigned under Manager A's subordinates
    console.log("[Test] Verifying Employee B appears in Manager A's /managing/my-employees...");
    const myWorkersRes = await fetch(`${BASE_URL}/managing/my-employees`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${managerToken}` }
    });
    const myWorkersData = await myWorkersRes.json();
    const assignedWorker = myWorkersData.data.find(w => w.userId === employeeUserId);
    if (!assignedWorker) throw new Error("Assigned employee not found in Manager A's workers list");
    if (assignedWorker.salary !== 8500) throw new Error(`Assigned employee salary mismatch: ${assignedWorker.salary}`);
    console.log(`[Success] Employee B confirmed in Manager A's team with Salary: ${assignedWorker.salary} SAR.`);

    // 8. Register Manager C and verify Manager C CANNOT claim already-assigned Employee B
    const managerCEmail = generateRandomEmail("dir_manager_c");
    console.log("[Test] Registering Manager C and attempting duplicate assignment...");
    const managerCRegRes = await fetch(`${BASE_URL}/users/logUp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: managerCEmail,
        fullName: "Director Salem Al-Harbi",
        password: "password123",
        role: "SUPER_ADMIN",
        phone: "0555559988"
      })
    });
    const managerCData = await managerCRegRes.json();
    const managerCToken = managerCData.token;

    const duplicateAssignRes = await fetch(`${BASE_URL}/managing/add-employee/${employeeUserId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${managerCToken}`
      },
      body: JSON.stringify({ salary: 9000 })
    });

    if (duplicateAssignRes.status === 201) {
      throw new Error("System allowed Manager C to claim an employee who was already assigned to Manager A!");
    }
    console.log("[Success] Duplicate assignment correctly blocked with error response.");

    console.log("\n=== ALL DIRECTORY & EMPLOYEE ASSIGNMENT E2E TESTS PASSED SUCCESSFULLY! ===");
    process.exit(0);

  } catch (err) {
    console.error("\n[Error] Directory & Employee Assignment E2E Test FAILED:", err.message);
    process.exit(1);
  }
}

runDirectorySearchE2ETests();
