const backendBase = "http://localhost:3200";

// --- GLOBAL VARIABLES ---
let connectBtn,
  studentStatus,
  examList,
  dashboardContainer,
  testTakerContainer,
  exitTestBtn,
  studentExamTitle,
  studentQuestionsContainer,
  submitTestBtn,
  testResult,
  generateHashBtn,
  hashGenContainer,
  submitContainer,
  quickExamIDInput,
  quickAttemptHashInput,
  quickFindBtn,
  quickScoreResultDiv;

let connectedAccount = null;
let provider, signer, contract, contractInfo;
let currentExamData = null;
let currentAttemptHash = null;

// --- Helper Functions ---
function logStatus(message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
  if (studentStatus) {
    studentStatus.innerHTML =
      `<div class="mb-1">[${timestamp}] ${message}</div>` +
      studentStatus.innerHTML;
  }
}

function setControlsEnabled(enabled) {
  if (connectBtn) connectBtn.disabled = !enabled;
  if (generateHashBtn) generateHashBtn.disabled = !enabled;
  if (submitTestBtn) submitTestBtn.disabled = !enabled;
  if (quickFindBtn) quickFindBtn.disabled = !enabled;
}

// --- MetaMask Connection ---
async function connectMetaMask() {
  console.log("=== CONNECT METAMASK START ===");
  if (typeof ethers === "undefined") {
    logStatus(
      "Ethers.js library is not loaded yet. Please wait and try again."
    );
    return;
  }
  if (!window.ethereum) {
    logStatus("Please install MetaMask!");
    alert("MetaMask is not installed. Please install MetaMask extension.");
    return;
  }
  try {
    logStatus("Requesting MetaMask accounts...");
    await window.ethereum.request({ method: "eth_requestAccounts" });
    handleAccountsChanged();
  } catch (error) {
    console.error("Connection error:", error);
    logStatus(`Connection prompt was rejected or failed: ${error.message}`);
  }
}

async function handleAccountsChanged() {
  console.log("=== HANDLE ACCOUNTS CHANGED ===");
  if (!window.ethereum) return;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });

    if (accounts.length === 0) {
      connectedAccount = null;
      contract = null;
      connectBtn.textContent = "Connect MetaMask";
      examList.innerHTML = "<br><br>Please connect your wallet to see exams.";
      logStatus("No accounts connected.");
      return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();

    try {
      logStatus("Checking backend connection...");
      const teacherAddrResp = await fetch(`${backendBase}/api/teacher-address`);
      if (!teacherAddrResp.ok) {
        throw new Error("Backend server not responding");
      }
      const { teacherAddress } = await teacherAddrResp.json();

      const currentAccount = accounts[0];

      if (currentAccount.toLowerCase() === teacherAddress.toLowerCase()) {
        connectedAccount = null;
        contract = null;
        connectBtn.textContent = "Switch to Student Account";
        examList.innerHTML =
          "<br><br>Teacher account detected. Please switch to a student account in MetaMask.";
        logStatus(
          "This is the teacher's account. Please switch to a student account in MetaMask."
        );
        return;
      }

      connectedAccount = currentAccount;
      connectBtn.textContent = `Connected: ${connectedAccount.substring(
        0,
        6
      )}...${connectedAccount.substring(38)}`;
      logStatus(`Student account connected: ${connectedAccount}`);

      if (!contractInfo) {
        logStatus("Fetching contract information...");
        const infoResp = await fetch(`${backendBase}/api/contract-info`);
        if (!infoResp.ok) throw new Error("Could not fetch contract info.");
        contractInfo = await infoResp.json();
      }

      contract = new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        signer
      );
      logStatus(`Smart contract initialized at: ${contract.address}`);

      const network = await provider.getNetwork();
      logStatus(
        `Connected to network: ${network.name} (Chain ID: ${network.chainId})`
      );

      const balance = await provider.getBalance(connectedAccount);
      const balanceInEth = ethers.utils.formatEther(balance);
      logStatus(`Account balance: ${parseFloat(balanceInEth).toFixed(4)} ETH`);

      if (parseFloat(balanceInEth) < 0.001) {
        logStatus(
          "⚠️ Warning: Low balance. You may not have enough gas for transactions."
        );
      }

      fetchAndRenderExams();
      if (window.examFetchInterval) clearInterval(window.examFetchInterval);
      window.examFetchInterval = setInterval(fetchAndRenderExams, 30000);
    } catch (backendError) {
      console.error("Backend error:", backendError);
      logStatus(`Backend Error: ${backendError.message}`);
      examList.innerHTML = `<br><br><div class="bg-red-100 p-4 rounded">
        <strong>Backend Server Error</strong><br>
        Cannot connect to backend at ${backendBase}<br>
        Please ensure your Node.js backend server is running.<br>
        Error: ${backendError.message}
      </div>`;
    }
  } catch (error) {
    console.error("Handle accounts error:", error);
    logStatus(`Connection failed: ${error.message}`);
  }
}

// --- Exam List Functions ---
async function fetchAndRenderExams() {
  try {
    const examsResp = await fetch(`${backendBase}/api/exams`);
    if (!examsResp.ok) {
      throw new Error(`HTTP ${examsResp.status}: ${examsResp.statusText}`);
    }
    const exams = await examsResp.json();
    renderExams(exams);
  } catch (err) {
    console.error("Fetch exams error:", err);
    logStatus(`Failed to load exams: ${err.message}`);
    examList.innerHTML = `<div class="bg-red-100 p-4 rounded">
      <strong>Failed to load exams</strong><br>
      ${err.message}
    </div>`;
  }
}

function renderExams(exams) {
  if (!examList) return;
  examList.innerHTML = "";
  if (!exams || exams.length === 0) {
    examList.innerHTML = "<br><br>No exams scheduled yet.";
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  exams.sort((a, b) => a.startTime - b.startTime);

  exams.forEach((exam) => {
    let status, buttonHtml, statusColor;
    // Extract UUID from formLink
    const formLinkParts = exam.formLink.split("/");
    const examUUID = formLinkParts[formLinkParts.length - 1];
    const isCustomTest = exam.formLink.includes("/api/exams/");

    if (now < exam.startTime) {
      status = "Upcoming";
      statusColor = "bg-yellow-200 text-yellow-800";
      buttonHtml = ``;
    } else if (now >= exam.startTime && now <= exam.endTime) {
      status = "Active";
      statusColor = "bg-green-200 text-green-800";
      if (isCustomTest) {
        // Pass the UUID to startCustomTest
        buttonHtml = `<button class="bg-blue-600 text-white rounded px-3 py-1 mx-2 hover:bg-blue-700" onclick="startCustomTest('${examUUID}')">Start Test</button>`;
      } else {
        // Handle non-custom (e.g., Google Forms) links
        buttonHtml = `<a class="bg-blue-600 text-white rounded px-3 py-1 mx-2 hover:bg-blue-700" href="${exam.formLink}" target="_blank">Open Test Form</a>`;
      }
    } else {
      status = "Finished";
      statusColor = "bg-red-200 text-red-800";
      buttonHtml = "";
    }

    const examElement = document.createElement("div");
    examElement.className =
      "p-3 border rounded-lg flex justify-between items-center bg-white shadow-sm hover:shadow-md transition";
    examElement.innerHTML = `
      <div>
        <div class="font-semibold">${
          exam.title || exam.examID
        } <span class="text-xs text-gray-500">[${exam.examID}]</span></div>
        <div class="text-sm text-gray-600">Start: ${new Date(
          exam.startTime * 1000
        ).toLocaleString()} &nbsp; End: ${new Date(
      exam.endTime * 1000
    ).toLocaleString()}</div>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-2 py-1 rounded text-xs font-medium ${statusColor}">${status}</span>
        ${buttonHtml}
      </div>
    `;
    examList.appendChild(examElement);
  });
}

// --- Test Taking Functions ---
function showDashboard() {
  dashboardContainer.classList.remove("hidden");
  testTakerContainer.classList.add("hidden");
  currentExamData = null;
  currentAttemptHash = null;
  fetchAndRenderExams();
}

// examId is now the UUID
window.startCustomTest = async function (examId) {
  console.log("=== START CUSTOM TEST ===");

  if (!connectedAccount || !contract) {
    alert("Please connect MetaMask first.");
    logStatus(
      "Cannot start test: MetaMask not connected or contract not initialized"
    );
    return;
  }
  try {
    logStatus("Fetching exam questions...");
    const response = await fetch(`${backendBase}/api/exams/${examId}`); // Use examId
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody);
    }
    const exam = await response.json();

    console.log("Exam data received:", exam);

    // The exam JSON is now loaded, including its UUID `id` field.
    currentExamData = exam;

    studentExamTitle.textContent = exam.title || exam.examName || "Exam";
    studentQuestionsContainer.innerHTML = "";
    testResult.innerHTML = "";

    hashGenContainer.classList.remove("hidden");
    studentQuestionsContainer.classList.add("hidden");
    submitContainer.classList.add("hidden");
    generateHashBtn.disabled = false;

    // Build questions
    exam.questions.forEach((q, index) => {
      const questionEl = document.createElement("div");
      questionEl.className =
        "question-card bg-white p-6 rounded-lg mb-4 border-2 border-gray-200 shadow-sm";
      questionEl.innerHTML = `
        <div class="font-semibold text-lg mb-3 text-gray-800">${index + 1}. ${
        q.text
      }</div>
      `;

      if (q.type === "MCQ" || q.options) {
        const optionsHtml = q.options
          .map(
            (opt, i) => `
            <label class="flex items-center gap-3 mb-2 p-3 cursor-pointer hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-300 transition">
              <input type="radio" name="q${index}" value="${i}" class="form-radio text-blue-600 w-5 h-5" />
              <span class="text-gray-700">${opt}</span>
            </label>
          `
          )
          .join("");
        questionEl.innerHTML += `<div class="ml-2 mt-2 space-y-1">${optionsHtml}</div>`;
      } else if (q.type === "TrueFalse") {
        questionEl.innerHTML += `
          <div class="ml-2 mt-2 space-y-2">
            <label class="flex items-center gap-3 p-3 cursor-pointer hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-300 transition">
              <input type="radio" name="q${index}" value="true" class="form-radio text-blue-600 w-5 h-5" />
              <span class="text-gray-700">True</span>
            </label>
            <label class="flex items-center gap-3 p-3 cursor-pointer hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-300 transition">
              <input type="radio" name="q${index}" value="false" class="form-radio text-blue-600 w-5 h-5" />
              <span class="text-gray-700">False</span>
            </label>
          </div>
        `;
      } else {
        questionEl.innerHTML += `
          <div class="ml-2 mt-2">
            <textarea name="q${index}" rows="4" class="w-full border-2 border-gray-300 focus:border-blue-500 p-3 rounded-lg mt-2 focus:outline-none" placeholder="Type your answer here..."></textarea>
          </div>
        `;
      }

      studentQuestionsContainer.appendChild(questionEl);
    });

    dashboardContainer.classList.add("hidden");
    testTakerContainer.classList.remove("hidden");
    logStatus("Exam loaded. Generate your Attempt Hash to begin.");
  } catch (err) {
    console.error("Start test error:", err);
    logStatus(`Could not load test: ${err.message}`);
    alert(`Failed to load test: ${err.message}`);
  }
};

async function handleGenerateHash() {
  console.log("=== GENERATE HASH ===");

  if (!connectedAccount) {
    alert("No account connected! Please connect MetaMask first.");
    return;
  }

  if (!currentExamData) {
    alert("No exam data loaded!");
    return;
  }

  const examID = currentExamData.examName || currentExamData.title;

  try {
    setControlsEnabled(false);
    logStatus("🔄 Generating Attempt Hash...");

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const dataToHash = `${connectedAccount}-${examID}-${timestamp}-${random}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(dataToHash);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    currentAttemptHash =
      "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    console.log("Generated hash:", currentAttemptHash);
    logStatus(`✅ Your Attempt Hash: ${currentAttemptHash}`);

    // Show a prominent modal-style alert
    alert(
      `✅ Attempt Hash Generated Successfully!\n\n${currentAttemptHash}\n\n⚠️ CRITICAL: SAVE THIS HASH!\n\nYou MUST save this hash to view your results later.\nCopy it now and save it somewhere safe (notepad, phone, etc.)\n\nWithout this hash, you CANNOT view your score!`
    );

    hashGenContainer.classList.add("hidden");
    studentQuestionsContainer.classList.remove("hidden");
    submitContainer.classList.remove("hidden");

    const newSubmitBtn = submitTestBtn.cloneNode(true);
    submitTestBtn.parentNode.replaceChild(newSubmitBtn, submitTestBtn);
    submitTestBtn = newSubmitBtn;
    submitTestBtn.addEventListener("click", handleSubmitTest);

    setControlsEnabled(true);
    logStatus(
      "✅ Ready to take the exam! Answer all questions and click Submit."
    );

    studentQuestionsContainer.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (err) {
    console.error("Generate hash error:", err);
    logStatus(`❌ Hash generation failed: ${err.message}`);
    alert(`Failed to generate hash: ${err.message}`);
    setControlsEnabled(true);
  }
}

async function handleSubmitTest() {
  console.log("=== SUBMIT TEST ===");
  if (!currentExamData || !currentAttemptHash) {
    alert("Missing exam data or attempt hash.");
    return;
  }

  // --- FIX: Ensure we send the exam's UUID (file id) to the backend ---
  const examFileId = currentExamData.id;
  const examDisplayName = currentExamData.examName || currentExamData.title;
  // --- END FIX ---

  const answers = [];
  currentExamData.questions.forEach((q, index) => {
    if (q.type === "MCQ" || q.type === "TrueFalse" || q.options) {
      const selected = document.querySelector(
        `input[name="q${index}"]:checked`
      );
      answers.push(selected ? selected.value : "");
    } else {
      const textarea = document.querySelector(`textarea[name="q${index}"]`);
      answers.push(textarea ? textarea.value.trim() : "");
    }
  });

  console.log("Answers:", answers);
  logStatus("Submitting test answers...");

  try {
    setControlsEnabled(false);
    logStatus("📤 Submitting your test...");

    const response = await fetch(`${backendBase}/api/submit-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examID: examFileId, // Send the UUID
        attemptHash: currentAttemptHash,
        answers,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }
    const result = await response.json();
    console.log("Submit result:", result);
    logStatus(`✅ Test submitted successfully!`);

    // CHANGED: Don't show score immediately, guide user to check results
    testResult.innerHTML = `<div class="bg-green-100 border-l-4 border-green-500 p-6 rounded-lg">
      <h4 class="font-bold text-2xl text-green-800 mb-4">✅ Test Submitted Successfully!</h4>
      
      <div class="bg-white p-4 rounded-lg mb-4">
        <p class="text-sm text-gray-700 mb-3">
          Your exam has been successfully submitted and auto-graded.
        </p>
        <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-3">
          <p class="font-semibold text-blue-800 mb-2">📌 Your Attempt Hash:</p>
          <code class="bg-gray-800 text-green-400 px-3 py-2 rounded text-sm block break-all font-mono">${currentAttemptHash}</code>
          <button onclick="navigator.clipboard.writeText('${currentAttemptHash}')" class="mt-2 text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
            📋 Copy to Clipboard
          </button>
        </div>
      </div>
      
      <div class="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
        <h5 class="font-bold text-yellow-800 mb-2">ℹ️ View Your Score</h5>
        <ol class="text-sm text-gray-800 space-y-2 list-decimal list-inside ml-2">
          <li>You can now view your *provisional* score.</li>
          <li>Go to the "Check Your Exam Results" section and enter:
            <ul class="ml-6 mt-1 list-disc">
              <li>Exam ID: <strong>${examDisplayName}</strong></li>
              <li>Your Attempt Hash: <strong>${currentAttemptHash.substring(
                0,
                10
              )}...</strong></li>
            </ul>
          </li>
          <li>Your score will be displayed immediately.</li>
          <li>This score will become official once the teacher publishes the results to the blockchain.</li>
        </ol>
      </div>
      
      <div class="mt-4 flex gap-3">
        <button onclick="showDashboard()" class="flex-1 bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition font-semibold">
          🏠 Back to Dashboard
        </button>
        <button onclick="document.getElementById('quickExamID').value='${examDisplayName}'; document.getElementById('quickAttemptHash').value='${currentAttemptHash}'; document.getElementById('quickExamID').scrollIntoView({behavior: 'smooth'})" class="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-semibold">
          📊 Go to Results Section
        </button>
      </div>
    </div>`;

    submitContainer.classList.add("hidden");
    setControlsEnabled(true);
  } catch (err) {
    console.error("Submit error:", err);
    logStatus(`❌ Submission failed: ${err.message}`);
    alert(`Failed to submit test: ${err.message}`);
    setControlsEnabled(true);
  }
}

// --- Quick Score Lookup Function (MODIFIED) ---
async function handleQuickFindScore() {
  const examID = quickExamIDInput.value.trim(); // This is the Exam Name
  const attemptHash = quickAttemptHashInput.value.trim();

  if (!examID || !attemptHash) {
    quickScoreResultDiv.innerHTML =
      '<p class="text-red-500">Please provide both Exam ID and Attempt Hash.</p>';
    return;
  }

  try {
    quickScoreResultDiv.innerHTML =
      '<p class="text-blue-500">🔍 Searching for your result...</p>';
    logStatus(`Looking up result for exam: ${examID}`);

    let examData;
    let isPublished = false;

    // Step 1: Check for PUBLISHED results on the blockchain
    try {
      const examResp = await fetch(`${backendBase}/getExamResult/${examID}`);
      if (examResp.ok) {
        examData = await examResp.json();
        if (examData.isResultUploaded) {
          isPublished = true;
        }
      }
    } catch (e) {
      logStatus("Could not fetch from blockchain, will check provisional.");
    }

    let studentResult;
    let errorMsg;

    if (isPublished) {
      // --- FLOW 1: RESULTS ARE PUBLISHED (Official) ---
      logStatus("Results are published. Fetching from official URL.");
      const resultURL = examData.resultURL;
      logStatus(`Fetching results from: ${resultURL}`);

      const resultsResp = await fetch(resultURL);
      if (!resultsResp.ok)
        throw new Error("Could not fetch published results file");

      const results = await resultsResp.json();
      studentResult = results.find((r) => r.attemptHash === attemptHash);

      if (!studentResult) {
        errorMsg =
          "Your Attempt Hash was not found in the *published* results file.";
      }
    } else {
      // --- FLOW 2: RESULTS NOT PUBLISHED (Provisional) ---
      logStatus(
        "Results not published yet. Checking for your provisional score..."
      );
      try {
        const provisionalResp = await fetch(
          `${backendBase}/api/get-provisional-result?examName=${encodeURIComponent(
            examID
          )}&attemptHash=${encodeURIComponent(attemptHash)}`
        );

        if (!provisionalResp.ok) {
          const errData = await provisionalResp.json();
          throw new Error(errData.error);
        }
        studentResult = await provisionalResp.json();
      } catch (err) {
        logStatus(`Provisional check failed: ${err.message}`);
        if (err.message.includes("not published yet")) {
          // This is the expected state before publishing
          errorMsg = "Results are not published yet. Please check back later.";
        } else {
          errorMsg = err.message;
        }
      }
    }

    // --- Display Logic ---
    if (studentResult) {
      logStatus(`✅ Result found!`);
      const isProvisional = studentResult.provisional;

      quickScoreResultDiv.innerHTML = `
        <div class="${
          isProvisional
            ? "bg-blue-100 border-blue-500"
            : "bg-green-100 border-green-500"
        } border-l-4 p-6 rounded-lg">
          <h4 class="font-bold text-2xl ${
            isProvisional ? "text-blue-800" : "text-green-800"
          } mb-4">
            ✅ Your Exam Result ${
              isProvisional ? "(Provisional)" : "(Official)"
            }
          </h4>
          <div class="bg-white rounded-lg p-4 space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-gray-700 font-semibold">Score:</span>
              <span class="text-3xl font-bold ${
                isProvisional ? "text-blue-600" : "text-green-600"
              }">${studentResult.score} / ${studentResult.total}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-700 font-semibold">Percentage:</span>
              <span class="text-2xl font-bold text-blue-600">${
                studentResult.percentage
              }%</span>
            </div>
            <div class="border-t pt-3">
              <p class="text-xs text-gray-600">Attempt Hash:</p>
              <code class="text-xs bg-gray-100 px-2 py-1 rounded block mt-1 break-all">${
                studentResult.attemptHash
              }</code>
            </div>
          </div>
          <div class="mt-4 ${
            isProvisional
              ? "bg-yellow-50 border-yellow-200"
              : "bg-blue-50 border-blue-200"
          } border rounded-lg p-3">
            <p class="text-sm ${
              isProvisional ? "text-yellow-800" : "text-blue-800"
            }">
              <strong>${isProvisional ? "Note:" : "✓ Verified:"}</strong> ${
        isProvisional
          ? "This is your provisional score. It is not final until published by your teacher."
          : "This result is from the final, blockchain-verified results file."
      }
            </p>
          </div>
        </div>
      `;
    } else {
      // --- Display Error Logic ---
      logStatus(`❌ Attempt hash not found.`);
      let errorTitle = "❌ Result Not Found";
      let errorDetails = `Your Attempt Hash was not found for the exam '${examID}'.`;

      if (errorMsg && errorMsg.includes("not published")) {
        errorTitle = "⏳ Results Not Published Yet";
        errorDetails = `Your teacher hasn't published the results yet. Please wait for the exam time to end and for your teacher to grade and publish the results.`;
      } else if (errorMsg) {
        errorDetails = errorMsg;
      }

      quickScoreResultDiv.innerHTML = `
        <div class="bg-red-100 border-l-4 border-red-500 p-4 rounded">
          <p class="font-semibold text-red-800">${errorTitle}</p>
          <p class="text-sm text-red-700 mt-2">
            ${errorDetails}
          </p>
          <p class="text-xs text-gray-600 mt-3">
            Please double-check your Exam ID and Attempt Hash, or contact your teacher.
          </p>
        </div>
      `;
    }
  } catch (err) {
    console.error("Quick find error:", err);
    logStatus(`Error: ${err.message}`);
    quickScoreResultDiv.innerHTML = `
      <div class="bg-red-100 border-l-4 border-red-500 p-4 rounded">
        <p class="font-semibold text-red-800">❌ Error</p>
        <p class="text-sm text-red-700 mt-2">${err.message}</p>
      </div>
    `;
  }
}

// --- Initializer ---
window.addEventListener("DOMContentLoaded", function () {
  console.log("=== PAGE LOADED ===");

  connectBtn = document.getElementById("connectBtn");
  studentStatus = document.getElementById("studentStatus");
  examList = document.getElementById("examList");
  dashboardContainer = document.getElementById("dashboardContainer");
  testTakerContainer = document.getElementById("testTakerContainer");
  exitTestBtn = document.getElementById("exitTestBtn");
  studentExamTitle = document.getElementById("studentExamTitle");
  studentQuestionsContainer = document.getElementById(
    "studentQuestionsContainer"
  );
  submitTestBtn = document.getElementById("submitTestBtn");
  testResult = document.getElementById("testResult");
  generateHashBtn = document.getElementById("generateHashBtn");
  hashGenContainer = document.getElementById("hashGenContainer");
  submitContainer = document.getElementById("submitContainer");
  quickExamIDInput = document.getElementById("quickExamID");
  quickAttemptHashInput = document.getElementById("quickAttemptHash");
  quickFindBtn = document.getElementById("quickFindBtn");
  quickScoreResultDiv = document.getElementById("quickScoreResult");

  // Removed verifyBtn, verifyExamIDInput, and verificationStatusDiv

  connectBtn.addEventListener("click", connectMetaMask);
  quickFindBtn.addEventListener("click", handleQuickFindScore);
  exitTestBtn.addEventListener("click", showDashboard);
  generateHashBtn.addEventListener("click", handleGenerateHash);

  // Removed verifyBtn event listener

  examList.innerHTML = "<br><br>Please connect MetaMask to view exams.";

  function initializeApp() {
    if (typeof ethers === "undefined") {
      console.log("Ethers.js not loaded yet, retrying...");
      logStatus("Ethers.js library not loaded yet, retrying in 100ms...");
      setTimeout(initializeApp, 100);
      return;
    }

    console.log("✅ Ethers.js loaded successfully");
    logStatus("✅ Ethers.js loaded. Application ready.");

    if (window.ethereum) {
      console.log("MetaMask detected");
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", (_chainId) => {
        console.log("Chain changed to:", _chainId);
        logStatus("Network changed. Reloading page...");
        window.location.reload();
      });
      handleAccountsChanged();
    } else {
      console.log("MetaMask not detected");
      logStatus("❌ MetaMask is not installed.");
      connectBtn.disabled = true;
      examList.innerHTML =
        "<br><br><div class='bg-yellow-100 p-4 rounded'>MetaMask is not installed. Please install MetaMask extension to continue.</div>";
    }
  }

  initializeApp();
  console.log("=== INITIALIZATION COMPLETE ===");
});
