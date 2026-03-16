async function loadTypes() {
  const response = await fetch("/types");
  const data = await response.json();
  const types = data.types || [];

  const select = document.getElementById("type");
  select.innerHTML = "";

  types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    select.appendChild(option);
  });
}

async function loadPendingJoke() {
  const status = document.getElementById("status");
  const response = await fetch("/moderate");
  const data = await response.json();

  if (!data.joke) {
    document.getElementById("token").value = "";
    document.getElementById("setup").value = "";
    document.getElementById("punchline").value = "";
    status.textContent = data.message || "No jokes available";
    return;
  }

  document.getElementById("token").value = data.token;
  document.getElementById("setup").value = data.joke.setup || "";
  document.getElementById("punchline").value = data.joke.punchline || "";
  document.getElementById("type").value = data.joke.type || "";
  status.textContent = "Pending joke loaded";
}

async function moderate(action) {
  const token = document.getElementById("token").value;
  if (!token) {
    document.getElementById("status").textContent = "No joke loaded";
    return;
  }

  const payload = {
    token,
    setup: document.getElementById("setup").value,
    punchline: document.getElementById("punchline").value,
    type: document.getElementById("type").value,
    action
  };

  const response = await fetch("/moderated", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  document.getElementById("status").textContent = data.message || "Done";

  await loadPendingJoke();
}

document.getElementById("approveBtn").addEventListener("click", () => moderate("approve"));
document.getElementById("rejectBtn").addEventListener("click", () => moderate("reject"));

(async function init() {
  await loadTypes();
  await loadPendingJoke();
  setInterval(loadPendingJoke, 3000);
})();