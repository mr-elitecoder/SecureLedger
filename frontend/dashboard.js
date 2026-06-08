const API = "http://localhost:5000/api";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");
if (!token || !user) window.location.href = "index.html";

document.getElementById("navName").textContent = user.FULL_NAME;
// Modern syntax (Node.js 14+, modern browsers)
document.getElementById("navAvatar").textContent =
  user?.full_name?.[0]?.toUpperCase() || ":)";

document.getElementById("userName").textContent = user.full_name;
document.getElementById("balanceAmount").textContent = Number(
  user.balance,
).toLocaleString("en-PK", { minimumFractionDigits: 2 });

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

let spendingTrendChart, statusChart;

// ── Search ──
async function searchUsers(query) {
  const dd = document.getElementById("searchDropdown");
  dd.style.display = "block";

  try {
    const url = `${API}/users/list`;
    console.log(url);
    console.log("Fetching users from:", url);
    console.log("Headers:", headers);

    const res = await fetch(url, { headers });
    console.log("Response status:", res.status);

    const data = await res.json();
    console.log("Response data:", data);

    if (data.success && data.users) {
      console.log("Found users:", data.users);
      if (query && query.length >= 2) {
        // Filter locally for search
        const filtered = data.users.filter(
          (u) =>
            u.full_name.toLowerCase().includes(query.toLowerCase()) ||
            u.email.toLowerCase().includes(query.toLowerCase()),
        );
        console.log(filtered);
        renderDropdown(filtered);
      } else {
        renderDropdown(data.users);
      }
    } else {
      console.log("No users returned from API");
      dd.innerHTML =
        '<div class="drop-item"><div class="drop-item-name" style="color:var(--muted)">No users found</div></div>';
    }
  } catch (err) {
    console.error("Error fetching users:", err);
    dd.innerHTML =
      '<div class="drop-item"><div class="drop-item-name" style="color:var(--muted)">Error loading users</div></div>';
  }
}

function renderDropdown(users) {
  const dd = document.getElementById("searchDropdown");
  dd.style.display = "block";

  console.log("Rendering dropdown with users:", users);

  if (!users || users.length === 0) {
    dd.innerHTML =
      '<div class="drop-item"><div class="drop-item-name" style="color:var(--muted)">No users found</div></div>';
    return;
  }

  dd.innerHTML = users
    .map(
      (u) => `
    <div class="drop-item" onclick="selectUser(${u.user_id},'${u.full_name.replace(/'/g, "\\'")}','${u.email}')">
      <div class="drop-item-name">${u.full_name}</div>
      <div class="drop-item-email">${u.email}</div>
    </div>`,
    )
    .join("");
}

function selectUser(id, name, email) {
  document.getElementById("receiverId").value = id;
  document.getElementById("recipientSearch").value = "";
  document.getElementById("searchDropdown").style.display = "none";
  document.getElementById("selectedUserName").textContent =
    `${name} — ${email}`;
  document.getElementById("selectedUser").style.display = "flex";
}

function clearRecipient() {
  document.getElementById("receiverId").value = "";
  document.getElementById("recipientSearch").value = "";
  document.getElementById("selectedUser").style.display = "none";
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".recipient-wrap"))
    document.getElementById("searchDropdown").style.display = "none";
});

// ── History ──
async function loadHistory() {
  try {
    const res = await fetch(`${API}/transactions/history?limit=20`, {
      headers,
    });
    const data = await res.json();

    // console.log("hey here it is ", data.transactions);

    if (!data.success) return;
    renderTransactionList(data.transactions);
  } catch {
    document.getElementById("historyList").innerHTML =
      '<div class="empty">Failed to load history.</div>';
  }
}

async function searchTransactions(query) {
  if (query.length < 2) {
    loadHistory();
    return;
  }
  try {
    const res = await fetch(
      `${API}/transactions/search?q=${encodeURIComponent(query)}`,
      {
        headers,
      },
    );
    const data = await res.json();
    if (!data.success) return;
    renderTransactionList(data.transactions);
  } catch (err) {
    console.error("Transaction search error:", err.message);
  }
}

function renderTransactionList(txns) {
  const list = document.getElementById("historyList");

  console.log(txns.length);

  if (!txns.length) {
    list.innerHTML = '<div class="empty">No transactions found.</div>';
    return;
  }

  let sent = 0,
    received = 0;
  txns.forEach((t) => {
    if (t.DIRECTION === "sent") sent += Number(t.AMOUNT);
    else received += Number(t.AMOUNT);
  });
  document.getElementById("statSent").textContent =
    "PKR " + sent.toLocaleString();

  console.log(
    (document.getElementById("statSent").textContent =
      "PKR " + sent.toLocaleString()),
  );

  document.getElementById("statReceived").textContent =
    "PKR " + received.toLocaleString();

  console.log(
    (document.getElementById("statReceived").textContent =
      "PKR " + received.toLocaleString()),
  );
  document.getElementById("statCount").textContent = txns.length;

  list.innerHTML = txns
    .map((t) => {
      const isFlagged = t.STATUS === "flagged";
      const isOutgoing = t.DIRECTION === "sent";
      const cls = isFlagged ? "flagged" : isOutgoing ? "sent" : "received";
      const icon = isFlagged ? "⚠" : isOutgoing ? "↑" : "↓";
      const sign = isOutgoing ? "−" : "+";
      const date = new Date(t.CREATED_AT).toLocaleString("en-PK", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const counterparty = t.COUNTERPARTY || "Unknown";
      return `
                <div class="txn-row">
                    <div class="txn-left">
                        <div class="txn-icon ${cls}">${icon}</div>
                        <div>
                            <div class="txn-name">${counterparty}</div>
                            <div class="txn-date">${date}</div>
                        </div>
                    </div>
                    <div class="txn-right">
                        <div class="txn-amount ${
                          isOutgoing ? "sent" : "received"
                        }">${sign} PKR ${Number(
                          t.AMOUNT,
                        ).toLocaleString()}</div>
                        <span class="txn-status ${t.STATUS}">${t.STATUS}</span>
                    </div>
                </div>`;
    })
    .join("");
}

async function loadUserSummary() {
  try {
    const res = await fetch(`${API}/users/me/summary`, { headers });
    const data = await res.json();
    if (!data.success) return;

    document.getElementById("statSent").textContent =
      "PKR " + Number(data.summary.total_sent).toLocaleString();
    document.getElementById("statReceived").textContent =
      "PKR " + Number(data.summary.total_received).toLocaleString();
    document.getElementById("statCount").textContent = Number(
      data.summary.transaction_count,
    ).toLocaleString();
    document.getElementById("statFlags").textContent = Number(
      data.summary.flagged_count,
    ).toLocaleString();
  } catch (err) {
    console.error("Dashboard summary error:", err.message);
  }
}

async function loadUserAnalytics() {
  try {
    const res = await fetch(`${API}/users/me/trends`, { headers });
    const data = await res.json();
    if (!data.success) return;

    const daily = data.trends.daily || [];
    const labels = daily.map((row) =>
      new Date(row.day).toLocaleDateString("en-PK", {
        month: "short",
        day: "numeric",
      }),
    );
    const sentData = daily.map((row) => row.sent);
    const receivedData = daily.map((row) => row.received);

    const spendingCtx = document.getElementById("spendingTrendChart");
    if (spendingTrendChart) spendingTrendChart.destroy();
    spendingTrendChart = new Chart(spendingCtx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Sent",
            data: sentData,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            tension: 0.35,
            fill: true,
            pointRadius: 3,
          },
          {
            label: "Received",
            data: receivedData,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            tension: 0.35,
            fill: true,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
            },
          },
        },
      },
    });

    const statusLabels = (data.trends.status_breakdown || []).map(
      (row) => row.status,
    );
    const statusValues = (data.trends.status_breakdown || []).map(
      (row) => row.count,
    );
    const statusCtx = document.getElementById("statusChart");
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(statusCtx, {
      type: "doughnut",
      data: {
        labels: statusLabels,
        datasets: [
          {
            data: statusValues,
            backgroundColor: ["#10b981", "#ef4444", "#3b82f6", "#fbbf24"],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  } catch (err) {
    console.error("Dashboard analytics error:", err.message);
  }
}

// ── Transfer ──
async function sendMoney() {
  const receiver_id = document.getElementById("receiverId").value;
  const amount = document.getElementById("amount").value;
  const description = document.getElementById("description").value;
  const alertEl = document.getElementById("transferAlert");
  alertEl.className = "alert";

  if (!receiver_id || !amount) {
    alertEl.innerHTML = "⚠ Select recipient and enter amount.";
    alertEl.className = "alert error show";
    return;
  }

  // Get receiver info for animation
  const selectedUserText =
    document.getElementById("selectedUserName").textContent;
  const [receiverName, receiverEmail] = selectedUserText.split(" — ");

  // Show animation modal
  showTransferAnimation(receiverName, receiverEmail, amount);

  try {
    const res = await fetch(`${API}/transactions/transfer`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        receiver_id: parseInt(receiver_id),
        amount: parseFloat(amount),
        description,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      completeTransferAnimation(false, data.message);
      alertEl.innerHTML = "⚠ " + data.message;
      alertEl.className = "alert error show";
      return;
    }

    // Show success animation
    completeTransferAnimation(true);
    alertEl.innerHTML = "✓ Transfer successful!";
    alertEl.className = "alert success show";
    clearRecipient();
    document.getElementById("amount").value = "";
    document.getElementById("description").value = "";

    const balRes = await fetch(`${API}/users/me/balance`, { headers });
    const balData = await balRes.json();
    if (balData.success)
      document.getElementById("balanceAmount").textContent = Number(
        balData.balance,
      ).toLocaleString("en-PK", { minimumFractionDigits: 2 });

    loadHistory();
  } catch {
    completeTransferAnimation(false, "Server unreachable");
    alertEl.innerHTML = "⚠ Transfer failed. Server unreachable.";
    alertEl.className = "alert error show";
  }
}

// Animation functions
function showTransferAnimation(receiverName, receiverEmail, amount) {
  const modal = document.getElementById("transferModal");
  document.getElementById("senderName").textContent = user.full_name;
  document.getElementById("senderEmail").textContent = user.email;
  document.getElementById("senderAvatar").textContent =
    user.full_name?.[0].toUpperCase();
  document.getElementById("receiverName").textContent = receiverName;
  document.getElementById("receiverEmail").textContent = receiverEmail;
  document.getElementById("receiverAvatar").textContent =
    receiverName?.[0].toUpperCase();
  document.getElementById("transferAmount").textContent =
    Number(amount).toLocaleString();
  document.getElementById("statusText").textContent =
    "Verifying transaction...";
  document.getElementById("statusText").style.color = "var(--accent-dk)";
  document
    .getElementById("transferStatus")
    .classList.remove("transfer-complete");
  document.getElementById("transferDoneBtn").style.display = "none";
  modal.classList.add("show");

  // Progress stages
  setTimeout(() => {
    document.getElementById("statusText").textContent = "Processing payment...";
  }, 500);

  setTimeout(() => {
    document.getElementById("statusText").textContent =
      "Recording transaction...";
  }, 1200);

  setTimeout(() => {
    document.getElementById("statusText").textContent = "Updating balances...";
  }, 1900);
}

function completeTransferAnimation(success, errorMsg = "") {
  const statusEl = document.getElementById("transferStatus");
  const statusIcon = statusEl.querySelector(".status-icon");
  const statusText = document.getElementById("statusText");

  setTimeout(() => {
    if (success) {
      statusIcon.textContent = "✓";
      statusText.textContent = "Transfer Completed Successfully!";
      statusText.style.color = "var(--accent-dk)";
      statusEl.classList.add("transfer-complete");
    } else {
      statusIcon.textContent = "✕";
      statusText.textContent = errorMsg || "Transfer Failed";
      statusText.style.color = "var(--danger)";
      statusEl.classList.add("transfer-complete");
      statusEl.style.background = "var(--danger-lt)";
      statusEl.style.borderColor = "#fed7d7";
    }
    document.getElementById("transferDoneBtn").style.display = "block";
  }, 2600);
}

function closeTransferModal() {
  const modal = document.getElementById("transferModal");
  modal.classList.remove("show");
  document.getElementById("transferStatus").style.background = "var(--bg)";
  document.getElementById("transferStatus").style.borderColor = "var(--border)";
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

loadUserSummary();
loadUserAnalytics();
loadHistory();
