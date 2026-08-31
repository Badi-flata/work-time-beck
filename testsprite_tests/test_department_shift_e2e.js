const BASE_URL = "http://localhost:3030";
const crypto = require('crypto');

function generateRandomEmail(prefix) {
  return `${prefix}_${crypto.randomBytes(3).toString('hex')}@example.com`;
}

async function runDepartmentShiftE2ETests() {
  console.log("=== Starting Comprehensive E2E Tests for Departments & Shifts Management ===");

  try {
    // 1. Sign up a Manager (SUPER_ADMIN)
    const managerEmail = generateRandomEmail("manager_dept");
    const managerPayload = {
      email: managerEmail,
      fullName: "Department Manager Admin",
      password: "password123",
      role: "SUPER_ADMIN",
      phone: "0555555577"
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

    // 2. Create Department: POST /department
    const deptUniqueName = `Engineering_${crypto.randomBytes(2).toString('hex')}`;
    console.log(`[Test] Creating Department '${deptUniqueName}'...`);
    const createDeptRes = await fetch(`${BASE_URL}/department`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        name: deptUniqueName,
        description: "Software engineering and development department"
      })
    });

    if (createDeptRes.status !== 201) {
      const errText = await createDeptRes.text();
      throw new Error(`Failed to create department. Status: ${createDeptRes.status}. Error: ${errText}`);
    }

    const createDeptData = await createDeptRes.json();
    const departmentId = createDeptData.department.id;
    console.log(`[Success] Department created with ID: ${departmentId}`);

    // 3. List Department Names: GET /department/list/names
    console.log("[Test] Fetching department names list...");
    const listNamesRes = await fetch(`${BASE_URL}/department/list/names`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${managerToken}` }
    });

    if (listNamesRes.status !== 200) {
      const errText = await listNamesRes.text();
      throw new Error(`Failed to list department names. Status: ${listNamesRes.status}. Error: ${errText}`);
    }

    const namesData = await listNamesRes.json();
    const foundDept = namesData.find(d => d.id === departmentId);
    if (!foundDept) throw new Error("Created department not found in list/names");
    console.log(`[Success] Department name verified in list/names: ${foundDept.name}`);

    // 4. Create Shift: POST /department/shifts
    console.log("[Test] Creating Shift 'Morning Shift' under department...");
    const createShiftRes = await fetch(`${BASE_URL}/department/shifts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        name: "Morning Shift",
        startTime: "08:00",
        endTime: "16:00",
        gracePeriodMinIn: 15,
        gracePeriodMinOut: 30,
        departmentsId: departmentId
      })
    });

    if (createShiftRes.status !== 201) {
      const errText = await createShiftRes.text();
      throw new Error(`Failed to create shift. Status: ${createShiftRes.status}. Error: ${errText}`);
    }

    const createShiftData = await createShiftRes.json();
    const shiftId = createShiftData.shift.id;
    console.log(`[Success] Shift created with ID: ${shiftId}`);

    // 5. Get Shifts: GET /department/shifts
    console.log("[Test] Fetching shifts list: GET /department/shifts...");
    const getShiftsRes = await fetch(`${BASE_URL}/department/shifts`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${managerToken}` }
    });

    if (getShiftsRes.status !== 200) {
      const errText = await getShiftsRes.text();
      throw new Error(`Failed to fetch shifts. Status: ${getShiftsRes.status}. Error: ${errText}`);
    }

    const shiftsList = await getShiftsRes.json();
    const foundShift = shiftsList.find(s => s.id === shiftId);
    if (!foundShift) throw new Error("Created shift not found in /department/shifts response");
    console.log(`[Success] Shift confirmed in /department/shifts. Name: ${foundShift.name}, Dept: ${foundShift.departmentName}`);

    // 6. Get All Departments with nested Shifts: GET /department
    console.log("[Test] Fetching all departments: GET /department...");
    const getDeptsRes = await fetch(`${BASE_URL}/department`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${managerToken}` }
    });

    if (getDeptsRes.status !== 200) {
      const errText = await getDeptsRes.text();
      throw new Error(`Failed to fetch departments. Status: ${getDeptsRes.status}. Error: ${errText}`);
    }

    const deptsList = await getDeptsRes.json();
    const foundFullDept = deptsList.find(d => d.id === departmentId);
    if (!foundFullDept || !foundFullDept.shift || foundFullDept.shift.length === 0) {
      throw new Error("Department does not contain nested shifts");
    }
    console.log(`[Success] Department contains ${foundFullDept.shift.length} nested shifts and count ${foundFullDept._count.employees} employees.`);

    // 7. Update Shift: PATCH /department/shifts/:id
    console.log("[Test] Updating Shift grace periods: PATCH /department/shifts/:id...");
    const updateShiftRes = await fetch(`${BASE_URL}/department/shifts/${shiftId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        gracePeriodMinIn: 20
      })
    });

    if (updateShiftRes.status !== 200) {
      const errText = await updateShiftRes.text();
      throw new Error(`Failed to update shift. Status: ${updateShiftRes.status}. Error: ${errText}`);
    }
    console.log("[Success] Shift updated successfully.");

    // 8. Update Department: PATCH /department/:id
    console.log("[Test] Updating Department description: PATCH /department/:id...");
    const updateDeptRes = await fetch(`${BASE_URL}/department/${departmentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        description: "Updated software engineering description"
      })
    });

    if (updateDeptRes.status !== 200) {
      const errText = await updateDeptRes.text();
      throw new Error(`Failed to update department. Status: ${updateDeptRes.status}. Error: ${errText}`);
    }
    console.log("[Success] Department updated successfully.");

    // 9. Delete Shift: DELETE /department/shifts/:id
    console.log("[Test] Deleting Shift: DELETE /department/shifts/:id...");
    const deleteShiftRes = await fetch(`${BASE_URL}/department/shifts/${shiftId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${managerToken}` }
    });

    if (deleteShiftRes.status !== 200) {
      const errText = await deleteShiftRes.text();
      throw new Error(`Failed to delete shift. Status: ${deleteShiftRes.status}. Error: ${errText}`);
    }
    console.log("[Success] Shift deleted successfully.");

    // 10. Delete Department: DELETE /department/:id
    console.log("[Test] Deleting Department: DELETE /department/:id...");
    const deleteDeptRes = await fetch(`${BASE_URL}/department/${departmentId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${managerToken}` }
    });

    if (deleteDeptRes.status !== 200) {
      const errText = await deleteDeptRes.text();
      throw new Error(`Failed to delete department. Status: ${deleteDeptRes.status}. Error: ${errText}`);
    }
    console.log("[Success] Department deleted successfully.");

    console.log("\n=== ALL DEPARTMENTS & SHIFTS E2E TESTS PASSED SUCCESSFULLY! ===");
    process.exit(0);

  } catch (error) {
    console.error("\n[Error] Departments & Shifts E2E Test FAILED:", error.message);
    process.exit(1);
  }
}

runDepartmentShiftE2ETests();
