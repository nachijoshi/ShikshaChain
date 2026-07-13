const backendBase = "http://localhost:3200";

// --- GLOBAL VARIABLES ---
let connectBtn,
  teacherStatus,
  allExamsList,
  createNewExamBtn,
  testBuilderModal,
  closeBuilderModal,
  addQuestionBtn,
  questionsContainer,
  saveCustomTestBtn,
  examNameInput,
  modalStartTimeInput,
  modalEndTimeInput;

let connectedAccount = null;
let questionCounter = 0;
let allExams = [];

// --- Helper Functions ---
function logStatus(message) {
  const timestamp = new Date().toLocaleTimeString();
  teacherStatus.innerHTML =
    `[${timestamp}] ${message}\n` + teacherStatus.innerHTML;
}

function setControlsEnabled(enabled) {
  createNewExamBtn.disabled = !enabled;
  // storeResultsBtn and gradeExamBtn removed
}

// --- MetaMask Connection & Account Handling ---
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
    setControlsEnabled(false);
  }
}

async function handleAccountsChanged() {
  if (!window.ethereum) return;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });

    if (accounts.length === 0) {
      connectedAccount = null;
      connectBtn.textContent = "Connect MetaMask";
      setControlsEnabled(false);
      logStatus("MetaMask is locked or no accounts are connected.");
      allExamsList.innerHTML =
        '<p class="text-gray-500">Connect wallet to view exams.</p>';
      return;
    }

    const teacherAddrResp = await fetch(`${backendBase}/api/teacher-address`);
    if (!teacherAddrResp.ok)
      throw new Error("Could not verify teacher address from backend.");
    const { teacherAddress } = await teacherAddrResp.json();
    const currentAccount = accounts[0];

    if (currentAccount.toLowerCase() !== teacherAddress.toLowerCase()) {
      connectedAccount = null;
      connectBtn.textContent = "Switch to Teacher Account";
      setControlsEnabled(false);
      logStatus(
        "Access Denied: Please connect with the designated teacher wallet."
      );
      allExamsList.innerHTML =
        '<p class="text-red-500">Incorrect account connected.</p>';
      return;
    }

    connectedAccount = currentAccount;
    connectBtn.textContent = `Connected: ${connectedAccount.substring(
      0,
      6
    )}...`;
    logStatus("Teacher account connected successfully.");
    setControlsEnabled(true);
    fetchAndRenderExams();
  } catch (error) {
    logStatus(`Account handling failed: ${error.message}`);
    setControlsEnabled(false);
  }
}

// --- Custom Test Builder Functions ---
function openTestBuilder() {
  examNameInput.value = "";
  modalStartTimeInput.value = "";
  modalEndTimeInput.value = "";
  questionsContainer.innerHTML = "";
  questionCounter = 0;
  addQuestion();
  testBuilderModal.classList.remove("hidden");
}

function addQuestion() {
  questionCounter++;
  const questionId = `q-${questionCounter}`;
  const questionCard = document.createElement("div");
  questionCard.className = "question-card";
  questionCard.id = questionId;
  questionCard.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <label class="block text-sm font-bold text-gray-700">Question ${questionCounter}</label>
            <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-red-500 hover:text-red-700 font-bold">&times; Remove</button>
        </div>
        <input type="text" class="question-text w-full p-2 border border-gray-300 rounded-lg mb-2" placeholder="Enter your question">
        <div class="options-container mt-3 space-y-2"></div>
        <button type="button" onclick="addOption('${questionId}')" class="mt-2 text-sm text-blue-600 hover:text-blue-800">+ Add Option</button>
    `;
  questionsContainer.appendChild(questionCard);
  addOption(questionId);
  addOption(questionId);
}

function addOption(questionId) {
  const optionsContainer = document.querySelector(
    `#${questionId} .options-container`
  );
  const optionCount = optionsContainer.children.length;
  const optionItem = document.createElement("div");
  optionItem.className = "option-item";
  optionItem.innerHTML = `
        <input type="radio" name="correct-answer-${questionId}" value="${optionCount}" class="correct-answer-radio">
        <input type="text" class="option-text flex-grow p-2 border border-gray-300 rounded-lg" placeholder="Option ${
          optionCount + 1
        }">
        <button type="button" onclick="this.parentElement.remove()" class="text-gray-500 hover:text-gray-700">&times;</button>
    `;
  optionsContainer.appendChild(optionItem);
}

async function saveCustomTest() {
  const examName = examNameInput.value.trim();
  const startTime = modalStartTimeInput.value;
  const endTime = modalEndTimeInput.value;
  if (!examName || !startTime || !endTime) {
    return alert("Please fill out the Exam Name, Start Time, and End Time.");
  }
  const questions = [];
  const questionCards = questionsContainer.querySelectorAll(".question-card");

  for (const card of questionCards) {
    const questionText = card.querySelector(".question-text").value.trim();
    if (!questionText) return alert("Please fill out all question texts.");

    const options = [];
    card.querySelectorAll(".option-text").forEach((input) => {
      if (input.value.trim()) options.push(input.value.trim());
    });

    if (options.length < 2)
      return alert("Each question must have at least two options.");

    const correctAnswerRadio = card.querySelector(
      ".correct-answer-radio:checked"
    );
    if (!correctAnswerRadio)
      return alert("Please select a correct answer for each question.");

    questions.push({
      type: "MCQ",
      text: questionText,
      options,
      correctAnswer: parseInt(correctAnswerRadio.value, 10),
    });
  }

  if (questions.length === 0) return alert("Please add at least one question.");

  const examData = {
    title: examName,
    examName,
    startTime,
    endTime,
    questions,
  };

  try {
    logStatus("Saving custom test configuration...");
    const response = await fetch(`${backendBase}/api/save-exam`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(examData),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let result;
      try {
        result = JSON.parse(errorBody);
      } catch (e) {
        result = { error: errorBody };
      }
      throw new Error(result.error || `Failed to save the test.`);
    }
    const result = await response.json();

    logStatus(`Custom test '${examName}' saved successfully.`);
    alert(`✅ Exam "${examName}" created successfully!`);
    testBuilderModal.classList.add("hidden");
    fetchAndRenderExams();
  } catch (err) {
    logStatus(`Error saving test: ${err.message}`);
    alert(`Error: ${err.message}`);
  }
}

// --- Teacher Functions ---
async function handleScheduleClick(customExamId) {
  if (!connectedAccount) return alert("Please connect MetaMask first.");
  const examToSchedule = allExams.find((e) => e.id === customExamId);
  if (!examToSchedule) return alert("Could not find the exam to schedule.");
  const { examName, startTime, endTime, id } = examToSchedule;
  const formLink = `${backendBase}/api/exams/${id}`;
  const startTimeUnix = Math.floor(new Date(startTime).getTime() / 1000);
  const endTimeUnix = Math.floor(new Date(endTime).getTime() / 1000);

  logStatus(`Scheduling exam ID: ${examName} on the blockchain...`);
  try {
    const resp = await fetch(`${backendBase}/createExam`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examID: examName,
        formLink,
        startTime: startTimeUnix,
        endTime: endTimeUnix,
        customExamId: id,
      }),
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      let body;
      try {
        body = JSON.parse(errorBody);
      } catch (e) {
        body = { error: errorBody };
      }
      throw new Error(body.error || `Failed to schedule exam.`);
    }
    const body = await resp.json();

    logStatus(`Success! Exam scheduled. TxHash: ${body.txHash}`);
    alert(`✅ Exam scheduled on blockchain!\n\nTransaction: ${body.txHash}`);
    fetchAndRenderExams();
  } catch (err) {
    logStatus(`Error scheduling exam: ${err.message}`);
    alert(`Error: ${err.message}`);
  }
}

// handleGradeExam function removed

async function fetchAndRenderExams() {
  if (!connectedAccount) return;

  // Removed gradingState and shouldPreserveGrading logic

  try {
    const resp = await fetch(`${backendBase}/api/all-exams`);
    if (!resp.ok) {
      const errorBody = await resp.text();
      throw new Error(errorBody);
    }
    const exams = await resp.json();
    allExams = exams;
    allExamsList.innerHTML = "";

    // Removed dropdown population logic

    if (!exams || exams.length === 0) {
      allExamsList.innerHTML =
        '<p class="text-gray-500">No exams created yet.</p>';
      return;
    }
    exams.forEach((exam) => {
      const examElement = document.createElement("div");
      examElement.className =
        "p-3 border rounded-lg flex justify-between items-center bg-white shadow-sm";

      let buttonHtml = "";
      let statusHtml = "";

      if (exam.scheduled) {
        statusHtml = `<p class="text-xs text-green-600 font-medium">✓ On Blockchain</p>`;
        // No button for scheduled exams
        buttonHtml = ``;
      } else {
        statusHtml = `<p class="text-xs text-gray-500">⏳ Not yet on blockchain</p>`;
        buttonHtml = `<button onclick="handleScheduleClick('${exam.id}')" class="bg-blue-600 text-white font-semibold py-1 px-3 rounded-md hover:bg-blue-700 transition">Schedule</button>`;
      }

      examElement.innerHTML = `
                <div>
                    <p class="font-bold text-gray-700">${exam.examName}</p>
                    ${statusHtml}
                </div>
                ${buttonHtml}
            `;
      allExamsList.appendChild(examElement);
    });

    // Removed reset logic for grading div
  } catch (err) {
    allExamsList.innerHTML = `<p class="text-red-500">Failed to load exams: ${err.message}</p>`;
  }
}

// handleStoreResults function removed

// --- Initializer ---
window.addEventListener("load", () => {
  // --- DOM Element Initialization ---
  connectBtn = document.getElementById("connectBtn");
  teacherStatus = document.getElementById("teacherStatus");
  allExamsList = document.getElementById("allExamsList");
  createNewExamBtn = document.getElementById("createNewExamBtn");
  testBuilderModal = document.getElementById("testBuilderModal");
  closeBuilderModal = document.getElementById("closeBuilderModal");
  addQuestionBtn = document.getElementById("addQuestionBtn");
  questionsContainer = document.getElementById("questionsContainer");
  saveCustomTestBtn = document.getElementById("saveCustomTestBtn");
  examNameInput = document.getElementById("examName");
  modalStartTimeInput = document.getElementById("modalStartTime");
  modalEndTimeInput = document.getElementById("modalEndTime");
  // Removed all grading and publishing elements

  // --- Event Listeners ---
  connectBtn.addEventListener("click", connectMetaMask);
  createNewExamBtn.addEventListener("click", openTestBuilder);
  closeBuilderModal.addEventListener("click", () =>
    testBuilderModal.classList.add("hidden")
  );
  addQuestionBtn.addEventListener("click", addQuestion);
  saveCustomTestBtn.addEventListener("click", saveCustomTest);
  // Removed listeners for storeResultsBtn and gradeExamBtn

  setControlsEnabled(false);
  logStatus("Please connect your MetaMask wallet to begin.");

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    handleAccountsChanged();
  }
});
