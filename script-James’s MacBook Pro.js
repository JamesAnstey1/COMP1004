// Vault key
const vaultKey = "vault";

// Current unlocked master password (kept in memory while vault is open)
let masterPassword = null;

// In-memory passwords array
let passwords = [];

/* -------------------------
   UI mode helpers
   ------------------------- */
function showCreateMode() {
  const authTitle = document.getElementById("authTitle");
  const authBtn = document.getElementById("authBtn");
  const confirm = document.getElementById("masterPwdConfirm");
  const overlay = document.getElementById("authOverlay");
  if (authTitle) authTitle.textContent = "Create Master Password";
  if (authBtn) authBtn.textContent = "Create Vault";
  if (confirm) confirm.style.display = "block";
  if (overlay) overlay.style.display = "block";
}

function showUnlockMode() {
  const authTitle = document.getElementById("authTitle");
  const authBtn = document.getElementById("authBtn");
  const confirm = document.getElementById("masterPwdConfirm");
  const overlay = document.getElementById("authOverlay");
  if (authTitle) authTitle.textContent = "Unlock Vault";
  if (authBtn) authBtn.textContent = "Unlock";
  if (confirm) confirm.style.display = "none";
  if (overlay) overlay.style.display = "block";
}

/*Crypto helpers*/
async function encrypt(text, password) {
  const enc = new TextEncoder();
  const pwKey = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 50000, hash: "SHA-256" },
    pwKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );

  return JSON.stringify({
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  });
}

async function decrypt(json, password) {
  const obj = JSON.parse(json);
  const enc = new TextEncoder();

  const pwKey = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );

  const salt = new Uint8Array(obj.salt);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 50000, hash: "SHA-256" },
    pwKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const iv = new Uint8Array(obj.iv);
  const data = new Uint8Array(obj.data);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return new TextDecoder().decode(decrypted);
}

/*Render / search helpers*/
function renderPasswords(list = passwords) {
  const ul = document.getElementById("myUL");
  if (!ul) return;
  ul.innerHTML = "";

  list.forEach(item => {
    const li = document.createElement("li");
    const tags = Array.isArray(item.tags) ? item.tags : [];
    li.innerHTML = `
      <strong>${escapeHtml(item.name)}</strong>
      <div class="tags">${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>

      <div class="email-title">
        <br>
        <strong>Email:</strong>
        <br>
        <div class="email">${escapeHtml(item.username_email)}</div>
        <br>
        <strong>Password:</strong>
        <br>
        <div class="email password-hidden" tabindex="0" role="button" aria-label="Reveal password">${escapeHtml(item.password)}
        </div>
        <button class="edit-btn" data-name="${escapeHtml(item.name)}">Edit</button>
        <button class="delete-btn" data-name="${escapeHtml(item.name)}">Delete</button>
        
      </div>
    `;

    ul.appendChild(li);
  });
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function mySearchFunction() {
  const input = document.getElementById("myInput");
  if (!input) return;
  const search = input.value.toLowerCase();

  const filtered = passwords.filter(item => {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    return (item.name || "").toLowerCase().includes(search) ||
      tags.some(tag => tag.toLowerCase().includes(search)) ||
      (item.username_email || "").toLowerCase().includes(search);
  });

  renderPasswords(filtered);
}

function parseTags(input) {
  if (!input) return [];
  return input.split(',').map(t => t.trim()).filter(Boolean);
}

/*DOM ready wiring*/
document.addEventListener('DOMContentLoaded', () => {
  // Elements used by auth flow
  const authBtn = document.getElementById("authBtn");
  const masterPwdInput = document.getElementById("masterPwd");
  const masterPwdConfirmInput = document.getElementById("masterPwdConfirm");
  const authMsg = document.getElementById("authMsg");
  const authOverlay = document.getElementById("authOverlay");

  // Modal elements
  const addBtn = document.getElementById('addBtn');
  const addModal = document.getElementById('addModal');
  const closeModal = document.getElementById('closeModal');
  const cancelAdd = document.getElementById('cancelAdd');
  const addForm = document.getElementById('addForm');



  // Ensure modal starts hidden
  if (addModal) {
    addModal.classList.add('hidden');
    addModal.setAttribute('aria-hidden', 'true');
  }

  // Startup: decide create vs unlock
  function startup() {
    const stored = localStorage.getItem(vaultKey);
    if (!stored) {
      showCreateMode();
    } else {
      showUnlockMode();
    }
  }

  startup();

  // Auth button handler (create or unlock)
  if (authBtn) {
    authBtn.onclick = async () => {
      const pwd = masterPwdInput ? masterPwdInput.value : "";
      const confirm = masterPwdConfirmInput ? masterPwdConfirmInput.value : "";
      const stored = localStorage.getItem(vaultKey);

      // creating the new vault
      if (!stored) {
        if (!pwd || pwd !== confirm) {
          if (authMsg) authMsg.textContent = "Passwords must match";
          return;
        }

        try {
          const encrypted = await encrypt(JSON.stringify(passwords), pwd);
          localStorage.setItem(vaultKey, encrypted);

          // store master password in memory while unlocked
          masterPassword = pwd;

          // hide the overlay and show UI
          if (authOverlay) authOverlay.style.display = "none";
          renderPasswords(passwords);
        } catch (err) {
          console.error("Failed to create vault:", err);
          if (authMsg) authMsg.textContent = "Failed to create vault";
        }

        return;
      }

      // Unlocking the existing vault
      try {
        const decrypted = await decrypt(stored, pwd);
        const vaultData = JSON.parse(decrypted);

        // Replace in-memory passwords with decrypted ones
        passwords.length = 0;
        passwords.push(...vaultData);

        // store master password while unlocked
        masterPassword = pwd;

        // Hide overlay and show UI
        if (authOverlay) authOverlay.style.display = "none";
        renderPasswords(passwords);
      } catch (e) {
        if (authMsg) authMsg.textCoxntent = "Incorrect password";
      }
    };
  }

  /*Modal open/close handlers*/
  function openModal() {
    if (!addModal) return;
    addModal.classList.remove('hidden');
    addModal.setAttribute('aria-hidden', 'false');
    const f = document.getElementById('fieldName');
    if (f) f.focus();
  }

  function closeModalFn() {
    if (!addModal) return;
    addModal.classList.add('hidden');
    addModal.setAttribute('aria-hidden', 'true');
    if (addForm) addForm.reset();s
  };

  if (addBtn) addBtn.addEventListener('click', openModal);
  if (closeModal) closeModal.addEventListener('click', closeModalFn);
  if (cancelAdd) cancelAdd.addEventListener('click', closeModalFn);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && addModal && !addModal.classList.contains('hidden')) closeModalFn();
  });

  /*Add form submit handler*/
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('fieldName').value.trim();
      const username_email = document.getElementById('fieldUser').value.trim();
      const passwordValue = document.getElementById('fieldPass').value;
      const tags = parseTags(document.getElementById('fieldTags').value);

      if (!name || !username_email || !passwordValue) {
        alert('Please fill name, username/email and password.');
        return;
      }

      if (!masterPassword) {
        alert('Vault is locked. Unlock the vault before adding accounts.');
        closeModalFn();
        return;
      }

      const editingName = addForm.getAttribute('data-editing');

    if (editingName) {
      // Editing existing entry
      const index = passwords.findIndex(p => p.name === editingName);
      if (index !== -1) {
        passwords[index] = { name, username_email, password: passwordValue, tags };
      }
      addForm.removeAttribute('data-editing');
    } else {
      // Adding new entry
      const newEntry = { name, username_email, password: passwordValue, tags };
      passwords.push(newEntry);
    }


      try {
        const plaintext = JSON.stringify(passwords);
        const encrypted = await encrypt(plaintext, masterPassword);
        localStorage.setItem(vaultKey, encrypted);
        renderPasswords(passwords);
        closeModalFn();
      } catch (err) {
        console.error('Failed to encrypt/save vault', err);
        alert('Could not save the new account. Try again.');
        passwords.pop();
      }
    });
  }

  // Wire search input if present
  const searchInput = document.getElementById("myInput");
  if (searchInput) {
    searchInput.addEventListener('input', mySearchFunction);
  }

  // Initial render (empty until unlocked)
  renderPasswords(passwords);
  // Toggle reveal on click/tap and keyboard (Enter/Space)
    const listEl = document.getElementById('myUL');
    if (listEl) {
        listEl.addEventListener('click', (e) => {
            const el = e.target.closest('.email.password-hidden');
            if (!el) return;
            el.classList.toggle('revealed');
        });

        listEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const el = e.target.closest('.email.password-hidden');
                if (!el) return;
                e.preventDefault();
                el.classList.toggle('revealed');
            }
        });
    }

        // Delete account handler
    const listEl2 = document.getElementById('myUL');
    if (listEl2) {
      listEl2.addEventListener('click', async (e) => {
        const btn = e.target.closest('.delete-btn');
        if (!btn) return;

        const nameToDelete = btn.getAttribute('data-name');
        if (!nameToDelete) return;

        // Remove from array
        passwords = passwords.filter(item => item.name !== nameToDelete);

        // Save updated encrypted vault
        try {
          const encrypted = await encrypt(JSON.stringify(passwords), masterPassword);
          localStorage.setItem(vaultKey, encrypted);
          renderPasswords(passwords);
        } catch (err) {
          console.error("Failed to update vault after delete:", err);
          alert("Could not delete this account.");
        }
     });
    }
    // Edit account handler
    if (listEl2) {
      listEl2.addEventListener('click', (e) => {
        const btn = e.target.closest('.edit-btn');
        if (!btn) return;

        const nameToEdit = btn.getAttribute('data-name');
        const entry = passwords.find(p => p.name === nameToEdit);
        if (!entry) return;

        // Open modal
        addModal.classList.remove('hidden');
        addModal.setAttribute('aria-hidden', 'false');

        // Pre-fill fields
        document.getElementById('fieldName').value = entry.name;
        document.getElementById('fieldUser').value = entry.username_email;
        ocument.getElementById('fieldPass').value = entry.password;
        ocument.getElementById('fieldTags').value = entry.tags.join(', ');

        // Mark that we are editing
        addForm.setAttribute('data-editing', nameToEdit);
       });
      }


});
