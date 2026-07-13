const backendBase = "http://localhost:3200";

// --- DOM Elements ---
const connectBtn = document.getElementById("connectBtn");
const storeResultsBtn = document.getElementById("storeResultsBtn");
const verifyBtn = document.getElementById("verifyBtn");
const teacherStatus = document.getElementById("teacherStatus");
const studentStatus = document.getElementById("studentStatus");
const examList = document.getElementById("examList");
const unscheduledExamsList = document.getElementById("unscheduledExamsList");

// Custom Test Builder Elements
const createNewExamBtn = document.getElementById("createNewExamBtn");
const testBuilderModal = document.getElementById("testBuilderModal");
const closeBuilderModal = document.getElementById("closeBuilderModal");
const addQuestionBtn = document.getElementById("addQuestionBtn");
const questionsContainer = document.getElementById("questionsContainer");
const saveCustomTestBtn = document.getElementById("saveCustomTestBtn");
const examNameInput = document.getElementById("examName");
const modalStartTimeInput = document.getElementById("modalStartTime");
const modalEndTimeInput = document.getElementById("modalEndTime");

// Student Test Taker Elements
const testTakerModal = document.getElementById("testTakerModal");
const closeTakerModal = document.getElementById("closeTakerModal");
const studentExamTitle = document.getElementById("studentExamTitle");
const studentQuestionsContainer = document.getElementById(
  "studentQuestionsContainer"
);
const submitTestBtn = document.getElementById("submitTestBtn");
const testResult = document.getElementById("testResult");

let connectedAccount = null;
let questionCounter = 0;
let unscheduledExams = [];

// --- Helper Functions ---
function logStatus(message, role) {
  const statusEl = role === "teacher" ? teacherStatus : studentStatus;
  const timestamp = new Date().toLocaleTimeString();
  statusEl.innerHTML = `[${timestamp}] ${message}\n` + statusEl.innerHTML;
}

async function generateHashFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- MetaMask Connection ---
async function connectMetaMask() {
  if (!window.ethereum) return alert("Please install MetaMask");
  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    connectedAccount = accounts[0];
    connectBtn.textContent = `Connected: ${connectedAccount.substring(
      0,
      6
    )}...${connectedAccount.substring(connectedAccount.length - 4)}`;
  } catch (error) {
    logStatus(`Connection failed: ${error.message}`, "teacher");
  }
}

// --- Exam List Functions ---
function renderExams(exams) {
  examList.innerHTML = "";
  if (!exams || exams.length === 0) {
    examList.innerHTML = '<p class="text-gray-500">No exams scheduled yet.</p>';
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  exams.sort((a, b) => a.startTime - b.startTime);

  exams.forEach((exam) => {
    let status, buttonHtml, statusColor;
    const isCustomTest = exam.formLink.includes("/api/exams/");

    if (now < exam.startTime) {
      status = "Upcoming";
      statusColor = "bg-yellow-200 text-yellow-800";
      buttonHtml = `<button class="bg-gray-400 text-white font-semibold py-1 px-3 rounded-md cursor-not-allowed" disabled>Attempt</button>`;
    } else if (now >= exam.startTime && now <= exam.endTime) {
      status = "Active";
      statusColor = "bg-green-200 text-green-800";
      if (isCustomTest) {
        buttonHtml = `<button onclick="startCustomTest('${exam.formLink}')" class="bg-green-600 text-white font-semibold py-1 px-3 rounded-md hover:bg-green-700 transition">Attempt</button>`;
      } else {
        buttonHtml = `<button onclick="window.open('${exam.formLink}', '_blank')" class="bg-green-600 text-white font-semibold py-1 px-3 rounded-md hover:bg-green-700 transition">Attempt</button>`;
      }
    } else {
      status = "Finished";
      statusColor = "bg-red-200 text-red-800";
      buttonHtml = `<button class="bg-gray-400 text-white font-semibold py-1 px-3 rounded-md cursor-not-allowed" disabled>Finished</button>`;
    }

    const examElement = document.createElement("div");
    examElement.className =
      "p-3 border rounded-lg flex justify-between items-center bg-white shadow-sm";
    examElement.innerHTML = `
            <div>
                <p class="font-bold text-gray-700">${exam.examID}</p>
                <p class="text-xs ${statusColor} px-2 py-1 rounded-full inline-block mt-1">${status}</p>
            </div>
            ${buttonHtml}
        `;
    examList.appendChild(examElement);
  });
}

async function fetchAndRenderExams() {
  try {
    const resp = await fetch(`${backendBase}/exams`);
    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { error: text };
    }
    if (!resp.ok) {
      throw new Error(data.error || text || "Failed to fetch scheduled exams.");
    }
    renderExams(data);
  } catch (err) {
    examList.innerHTML = `<p class="text-red-500">Failed to load exams: ${err.message}</p>`;
  }
}

// --- Custom Test Builder Functions ---
function openTestBuilder() {
  // Clear the modal for a new exam
  examNameInput.value = "";
  modalStartTimeInput.value = "";
  modalEndTimeInput.value = "";
  questionsContainer.innerHTML = "";
  questionCounter = 0;
  addQuestion(); // Add the first question automatically
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
            <button onclick="this.parentElement.parentElement.remove()" class="text-red-500 hover:text-red-700 font-bold">&times; Remove</button>
        </div>
        <input type="text" class="question-text w-full p-2 border border-gray-300 rounded-lg" placeholder="Enter your question">
        <div class="options-container mt-3 space-y-2">
            <!-- Options will be added here -->
        </div>
        <button onclick="addOption('${questionId}')" class="mt-2 text-sm text-blue-600 hover:text-blue-800">+ Add Option</button>
    `;
  questionsContainer.appendChild(questionCard);
  addOption(questionId);
  addOption(questionId); // Start with two options
}

function addOption(questionId) {
  const questionCard = document.getElementById(questionId);
  const optionsContainer = questionCard.querySelector(".options-container");
  const optionCount = optionsContainer.children.length;

  const optionItem = document.createElement("div");
  optionItem.className = "option-item";
  optionItem.innerHTML = `
        <input type="radio" name="correct-answer-${questionId}" value="${optionCount}" class="correct-answer-radio">
        <input type="text" class="option-text flex-grow p-2 border border-gray-300 rounded-lg" placeholder="Option ${
          optionCount + 1
        }">
        <button onclick="this.parentElement.remove()" class="text-gray-500 hover:text-gray-700">&times;</button>
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

  const title = examName; // Use examName as title for consistency

  const questions = [];
  const questionCards = questionsContainer.querySelectorAll(".question-card");

  for (const card of questionCards) {
    const questionText = card.querySelector(".question-text").value.trim();
    if (!questionText) {
      return alert("Please fill out all question texts.");
    }

    const options = [];
    const optionInputs = card.querySelectorAll(".option-text");
    optionInputs.forEach((input) => {
      if (input.value.trim()) {
        options.push(input.value.trim());
      }
    });

    if (options.length < 2) {
      return alert("Each question must have at least two options.");
    }

    const correctAnswerRadio = card.querySelector(
      ".correct-answer-radio:checked"
    );
    if (!correctAnswerRadio) {
      return alert("Please select a correct answer for each question.");
    }
    const correctAnswerIndex = parseInt(correctAnswerRadio.value, 10);

    questions.push({
      text: questionText,
      options,
      correctAnswer: correctAnswerIndex,
    });
  }

  if (questions.length === 0) {
    return alert("Please add at least one question.");
  }

  const examData = { title, examName, startTime, endTime, questions };

  try {
    logStatus("Saving custom test configuration...", "teacher");
    const response = await fetch(`${backendBase}/api/save-exam`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(examData),
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      result = { error: text };
    }

    if (!response.ok) {
      throw new Error(result.error || text || "Failed to save the test.");
    }

    logStatus(`Custom test '${examName}' saved successfully.`, "teacher");
    testBuilderModal.classList.add("hidden");
    fetchAndRenderUnscheduledExams(); // Refresh the list
  } catch (err) {
    logStatus(`Error saving test: ${err.message}`, "teacher");
    alert(`Error: ${err.message}`);
  }
}

// --- Teacher Functions ---
async function handleScheduleClick(customExamId) {
  if (!connectedAccount) return alert("Please connect MetaMask first.");

  const examToSchedule = unscheduledExams.find((e) => e.id === customExamId);
  if (!examToSchedule) {
    return alert("Could not find the exam to schedule.");
  }

  const examID = examToSchedule.examName; // This is the public name
  const formLink = `${backendBase}/api/exams/${examToSchedule.id}`; // This is the link to take the test
  const startTimeUnix = Math.floor(
    new Date(examToSchedule.startTime).getTime() / 1000
  );
  const endTimeUnix = Math.floor(
    new Date(examToSchedule.endTime).getTime() / 1000
  );

  logStatus(`Scheduling exam ID: ${examID} on the blockchain...`, "teacher");
  try {
    const resp = await fetch(`${backendBase}/createExam`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examID,
        formLink,
        startTime: startTimeUnix,
        endTime: endTimeUnix,
        customExamId: examToSchedule.id, // Send the file ID to the backend
      }),
    });

    const text = await resp.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = { error: text };
    }

    if (!resp.ok) {
      throw new Error(body.error || text || "Failed to schedule exam.");
    }

    logStatus(`Success! Exam scheduled. TxHash: ${body.txHash}`, "teacher");
    fetchAndRenderExams();
    fetchAndRenderUnscheduledExams();
  } catch (err) {
    logStatus(`Error scheduling exam: ${err.message}`, "teacher");
  }
}

async function fetchAndRenderUnscheduledExams() {
  try {
    const resp = await fetch(`${backendBase}/api/unscheduled-exams`);
    const text = await resp.text();
    let exams;
    try {
      exams = JSON.parse(text);
    } catch (e) {
      exams = { error: text };
    }

    if (!resp.ok) {
      throw new Error(
        exams.error || text || "Failed to fetch unscheduled exams."
      );
    }

    unscheduledExams = exams; // Store for later use

    unscheduledExamsList.innerHTML = "";
    if (!exams || exams.length === 0) {
      unscheduledExamsList.innerHTML =
        '<p class="text-gray-500">No unscheduled exams.</p>';
      return;
    }

    exams.forEach((exam) => {
      const examElement = document.createElement("div");
      examElement.className =
        "p-3 border rounded-lg flex justify-between items-center bg-white shadow-sm";
      examElement.innerHTML = `
                <div>
                    <p class="font-bold text-gray-700">${exam.examName}</p>
                    <p class="text-xs text-gray-500">Not yet on blockchain</p>
                </div>
                <button onclick="handleScheduleClick('${exam.id}')" class="bg-blue-600 text-white font-semibold py-1 px-3 rounded-md hover:bg-blue-700 transition">Schedule</button>
            `;
      unscheduledExamsList.appendChild(examElement);
    });
  } catch (err) {
    unscheduledExamsList.innerHTML = `<p class="text-red-500">Failed to load unscheduled exams: ${err.message}</p>`;
  }
}

async function handleStoreResults() {
  if (!connectedAccount) return alert("Please connect MetaMask first.");
  const examID = document.getElementById("resultsExamID").value.trim();
  const fileInput = document.getElementById("resultsFile");
  if (!examID || fileInput.files.length === 0)
    return alert("Provide Exam ID and results file.");

  const file = fileInput.files[0];
  logStatus(`Hashing results file for ID: ${examID}...`, "teacher");
  const fileHash = await generateHashFromFile(file);
  logStatus(`Generated Hash: ${fileHash}`, "teacher");

  try {
    const resp = await fetch(`${backendBase}/storeResult`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examID, resultHash: fileHash, resultURL: "" }),
    });

    const text = await resp.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = { error: text };
    }

    if (!resp.ok) {
      throw new Error(body.error || text || "Failed to store results hash.");
    }

    logStatus(
      `Success! Results hash stored. TxHash: ${body.txHash}`,
      "teacher"
    );
  } catch (err) {
    logStatus(`Error: ${err.message}`, "teacher");
  }
}

// --- Student Functions ---

async function startCustomTest(examUrl) {
  try {
    logStatus("Fetching exam questions...", "student");
    const response = await fetch(examUrl);
    const text = await response.text();
    let exam;
    try {
      exam = JSON.parse(text);
    } catch (e) {
      exam = { error: text };
    }

    if (!response.ok) {
      throw new Error(exam.error || text || "Could not fetch exam.");
    }

    studentExamTitle.textContent = exam.title;
    studentQuestionsContainer.innerHTML = "";
    testResult.innerHTML = "";
    submitTestBtn.disabled = false;

    exam.questions.forEach((q, index) => {
      const questionEl = document.createElement("div");
      questionEl.className = "question-card bg-white";
      const optionsHtml = q.options
        .map(
          (option, i) => `
                <div class="option-item">
                    <input type="radio" id="q${index}o${i}" name="question-${index}" value="${i}">
                    <label for="q${index}o${i}" class="ml-2">${option}</label>
                </div>
            `
        )
        .join("");

      questionEl.innerHTML = `
                <p class="font-semibold mb-2">${index + 1}. ${q.text}</p>
                <div class="space-y-2">${optionsHtml}</div>
            `;
      studentQuestionsContainer.appendChild(questionEl);
    });

    submitTestBtn.onclick = () => submitCustomTest(examUrl.split("/").pop());

    testTakerModal.classList.remove("hidden");
  } catch (err) {
    logStatus(`Error starting test: ${err.message}`, "student");
    alert(`Error: ${err.message}`);
  }
}

async function submitCustomTest(customExamId) {
  const answers = [];
  const questionElements =
    studentQuestionsContainer.querySelectorAll(".question-card");
  questionElements.forEach((q, index) => {
    const selectedOption = q.querySelector(
      `input[name="question-${index}"]:checked`
    );
    answers.push(selectedOption ? parseInt(selectedOption.value, 10) : null);
  });

  try {
    logStatus("Submitting your answers...", "student");
    const response = await fetch(
      `${backendBase}/api/submit-exam/${customExamId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }
    );

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      result = { error: text };
    }

    if (!response.ok) {
      throw new Error(result.error || text || "Failed to submit.");
    }

    logStatus(
      `Test submitted! Your score: ${result.score}/${result.total}`,
      "student"
    );
    testResult.innerHTML = `<div class="p-4 bg-blue-100 border border-blue-300 rounded-lg text-center">
            <h4 class="font-bold text-lg">Test Complete!</h4>
            <p class="text-2xl">Your Score: <span class="font-bold">${result.score}</span> out of <span class="font-bold">${result.total}</span></p>
        </div>`;
    submitTestBtn.disabled = true;
  } catch (err) {
    logStatus(`Submission Error: ${err.message}`, "student");
    alert(`Error: ${err.message}`);
  }
}

async function handleVerifyResults() {
  if (!connectedAccount) return alert("Please connect MetaMask first.");
  const examID = document.getElementById("verifyExamID").value.trim();
  const fileInput = document.getElementById("verifyFile");
  if (!examID || fileInput.files.length === 0) {
    return alert(
      "Please provide the Exam ID and upload your result file to verify."
    );
  }

  const file = fileInput.files[0];
  logStatus(`Hashing your local file for verification...`, "student");
  const localFileHash = await generateHashFromFile(file);
  logStatus(`Your file's hash: ${localFileHash}`, "student");

  logStatus(
    `Fetching official result hash for exam '${examID}' from blockchain...`,
    "student"
  );
  try {
    const resp = await fetch(`${backendBase}/getExamResult/${examID}`);
    const text = await resp.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = { error: text };
    }

    if (!resp.ok) {
      throw new Error(body.error || text || "Failed to fetch results.");
    }

    if (body.isResultUploaded) {
      const onChainHash = body.resultHash;
      logStatus(`Official hash on blockchain: ${onChainHash}`, "student");

      if (localFileHash === onChainHash) {
        logStatus(
          "✅ VERIFIED: Your file matches the official record on the blockchain!",
          "student"
        );
      } else {
        logStatus(
          "❌ NOT VERIFIED: Your file does NOT match the official record.",
          "student"
        );
      }
    } else {
      logStatus(
        `Results for exam '${examID}' have not been published yet.`,
        "student"
      );
    }
  } catch (err) {
    logStatus(`Error: ${err.message}`, "student");
  }
}

// --- Initializer ---
window.addEventListener("load", () => {
  connectBtn.addEventListener("click", connectMetaMask);
  storeResultsBtn.addEventListener("click", handleStoreResults);
  verifyBtn.addEventListener("click", handleVerifyResults);

  // Test builder listeners
  createNewExamBtn.addEventListener("click", openTestBuilder);
  closeBuilderModal.addEventListener("click", () =>
    testBuilderModal.classList.add("hidden")
  );
  closeTakerModal.addEventListener("click", () =>
    testTakerModal.classList.add("hidden")
  );
  addQuestionBtn.addEventListener("click", addQuestion);
  saveCustomTestBtn.addEventListener("click", saveCustomTest);

  fetchAndRenderExams();
  fetchAndRenderUnscheduledExams();
  setInterval(fetchAndRenderExams, 30000);
});
