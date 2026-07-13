const backendBase = "http://localhost:3200";

let connectBtn, adminStatus, pendingRequestsList, adminPanel;
let connectedAccount = null;
let adminAddress = null;

function logStatus(message) {
  const timestamp = new Date().toLocaleTimeString();
  adminStatus.innerHTML = `[${timestamp}] ${message}\n` + adminStatus.innerHTML;
}

async function connectMetaMask() {
  if (!window.ethereum) {
    logStatus("Please install MetaMask!");
    return;
  }
  try {
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });
    handleAccountsChanged();
  } catch (error) {
    logStatus(`Connection prompt was rejected or failed: ${error.message}`);
  }
}

async function handleAccountsChanged() {
  if (!window.ethereum) return;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });

    if (accounts.length === 0) {
      connectedAccount = null;
      connectBtn.textContent = "Connect MetaMask";
      adminPanel.classList.add("hidden");
      logStatus("MetaMask is locked or no accounts are connected.");
      return;
    }

    if (!adminAddress) {
      const adminAddrResp = await fetch(`${backendBase}/api/admin-address`);
      if (!adminAddrResp.ok)
        throw new Error("Could not fetch admin address from backend.");
      const data = await adminAddrResp.json();
      adminAddress = data.adminAddress;
    }

    const currentAccount = accounts[0];
    if (currentAccount.toLowerCase() !== adminAddress.toLowerCase()) {
      connectedAccount = null;
      connectBtn.textContent = "Switch to Admin Account";
      adminPanel.classList.add("hidden");
      logStatus(
        "Access Denied: Please connect with the designated admin wallet."
      );
      return;
    }

    connectedAccount = currentAccount;
    connectBtn.textContent = `Connected: ${connectedAccount.substring(
      0,
      6
    )}...`;
    logStatus("Admin account connected successfully.");
    adminPanel.classList.remove("hidden");
    fetchAndRenderPendingRequests();
  } catch (error) {
    logStatus(`Account handling failed: ${error.message}`);
  }
}

async function fetchAndRenderPendingRequests() {
  if (!connectedAccount) return;
  try {
    const response = await fetch(`${backendBase}/api/pending-requests`);
    if (!response.ok) throw new Error(await response.text());
    const requests = await response.json();

    pendingRequestsList.innerHTML = "";
    if (requests.length === 0) {
      pendingRequestsList.innerHTML =
        '<p class="text-gray-500">No pending login requests.</p>';
      return;
    }

    requests.forEach((req) => {
      const reqElement = document.createElement("div");
      reqElement.className =
        "p-3 border rounded-lg flex justify-between items-center bg-white shadow-sm";
      reqElement.innerHTML = `
                <div>
                    <p class="font-mono text-sm text-gray-700">${
                      req.address
                    }</p>
                    <p class="text-xs uppercase font-bold ${
                      req.role === "teacher"
                        ? "text-indigo-600"
                        : "text-teal-600"
                    }">${req.role}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="handleApproval('${
                      req.address
                    }', 'approved')" class="bg-green-500 text-white font-semibold py-1 px-3 rounded-md hover:bg-green-600 transition">Approve</button>
                    <button onclick="handleApproval('${
                      req.address
                    }', 'denied')" class="bg-red-500 text-white font-semibold py-1 px-3 rounded-md hover:bg-red-600 transition">Deny</button>
                </div>
            `;
      pendingRequestsList.appendChild(reqElement);
    });
  } catch (err) {
    logStatus(`Failed to fetch requests: ${err.message}`);
  }
}

async function handleApproval(address, status) {
  try {
    logStatus(`Setting status for ${address} to ${status}...`);
    const endpoint =
      status === "approved" ? "/api/approve-request" : "/api/deny-request";

    const response = await fetch(`${backendBase}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });

    if (!response.ok) throw new Error(await response.text());

    logStatus(`Successfully set status for ${address}.`);
    fetchAndRenderPendingRequests();
  } catch (err) {
    logStatus(`Error during approval: ${err.message}`);
  }
}

window.addEventListener("load", () => {
  connectBtn = document.getElementById("connectBtn");
  adminStatus = document.getElementById("adminStatus");
  pendingRequestsList = document.getElementById("pendingRequestsList");
  adminPanel = document.getElementById("admin-panel");

  connectBtn.addEventListener("click", connectMetaMask);

  logStatus("Please connect your Admin MetaMask wallet.");

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    handleAccountsChanged();
  }
});
