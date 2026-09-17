/** Local-only login — no backend or database. */
export async function login({ id }) {
  const employeeId = String(id).trim();

  return {
    id: employeeId,
    empid: employeeId,
    name: 'UI User',
  };
}
