import { authenticateAccount } from "../lib/account.js";

export async function authCommand() {
  const account = await authenticateAccount();
  console.log(`Account ready: ${account.email}`);
}
