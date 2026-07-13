const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const axios = require("axios");
const { parse } = require("csv-parse/sync");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

let provider, wallet, contract;

const EXAMS_DIR = path.join(__dirname, "exams");
const SUBMISSIONS_DIR = path.join(__dirname, "submissions");
const RESULTS_DIR = path.join(__dirname, "results");

// Create directories if they don't exist
[EXAMS_DIR, SUBMISSIONS_DIR, RESULTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// --- Helper Function ---
function findExamFileIdByName(examName) {
  try {
    const allFiles = fs.readdirSync(EXAMS_DIR);
    const jsonFiles = allFiles.filter((file) => file.endsWith(".json"));

    for (const file of jsonFiles) {
      const filePath = path.join(EXAMS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath));
      if (data.examName === examName || data.title === examName) {
        return data.id; // Return the file ID (UUID)
      }
    }
  } catch (error) {
    console.error("Error in findExamFileIdByName:", error);
    return null;
  }
  return null;
}

// --- API Route Definitions ---

// NEW: Endpoint to get contract info
app.get("/api/contract-info", (req, res) => {
  if (!contract) {
    return res.status(503).json({ error: "Backend not fully initialized." });
  }
  try {
    const artifact = JSON.parse(fs.readFileSync("./ShikshaChainABI.json"));
    res.json({
      address: contract.address,
      abi: artifact.abi,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load contract info" });
  }
});

// NEW: Endpoint to get the teacher's address
app.get("/api/teacher-address", (req, res) => {
  if (wallet) {
    res.json({ teacherAddress: wallet.address });
  } else {
    res.status(503).json({ error: "Backend not fully initialized." });
  }
});

// Overwrite /createExam to handle scheduled flag
app.post("/createExam", async (req, res) => {
  if (!contract)
    return res
      .status(503)
      .json({ error: "Blockchain connection not available." });
  const { examID, formLink, startTime, endTime, customExamId } = req.body;
  try {
    const tx = await contract.createExam(examID, formLink, startTime, endTime);
    await tx.wait();

    // After successful transaction, mark the custom exam as scheduled
    if (customExamId) {
      const examFilePath = path.join(EXAMS_DIR, `${customExamId}.json`);
      if (fs.existsSync(examFilePath)) {
        const examData = JSON.parse(fs.readFileSync(examFilePath));
        examData.scheduled = true;
        fs.writeFileSync(examFilePath, JSON.stringify(examData, null, 2));
      }
    }
    res.json({ status: "success", txHash: tx.hash });
  } catch (err) {
    console.error("--- ERROR IN /createExam ---", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/registerStudents", async (req, res) => {
  if (!contract)
    return res
      .status(503)
      .json({ error: "Blockchain connection not available." });
  const { examID, studentAddresses } = req.body;
  try {
    const tx = await contract.registerStudents(examID, studentAddresses);
    await tx.wait();
    res.json({ status: "success", txHash: tx.hash });
  } catch (err) {
    console.error("Error in /registerStudents:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/storeResult", async (req, res) => {
  if (!contract)
    return res
      .status(503)
      .json({ error: "Blockchain connection not available." });
  const { examID, resultHash, resultURL } = req.body;
  try {
    const tx = await contract.storeResult(examID, resultHash, resultURL);
    await tx.wait();
    res.json({ status: "success", txHash: tx.hash });
  } catch (err) {
    console.error("Error in /storeResult:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/exams", async (req, res) => {
  if (!contract)
    return res
      .status(503)
      .json({ error: "Blockchain connection not available." });
  try {
    const allExamsData = await contract.getAllExams();
    const formattedExams = allExamsData.map((exam) => ({
      examID: exam.examID,
      title: exam.examID,
      formLink: exam.formLink,
      startTime: parseInt(exam.startTime.toString()),
      endTime: parseInt(exam.endTime.toString()),
      isResultUploaded: exam.isResultUploaded,
    }));
    res.json(formattedExams);
  } catch (err) {
    console.error("--- ERROR IN /api/exams ---", err);
    res.status(500).json({ error: err.message });
  }
});

// Legacy endpoint for backward compatibility
app.get("/exams", async (req, res) => {
  if (!contract)
    return res
      .status(503)
      .json({ error: "Blockchain connection not available." });
  try {
    const allExamsData = await contract.getAllExams();
    const formattedExams = allExamsData.map((exam) => ({
      examID: exam.examID,
      formLink: exam.formLink,
      startTime: parseInt(exam.startTime.toString()),
      endTime: parseInt(exam.endTime.toString()),
      isResultUploaded: exam.isResultUploaded,
    }));
    res.json(formattedExams);
  } catch (err) {
    console.error("--- ERROR IN /exams ---", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/getExamResult/:examID", async (req, res) => {
  if (!contract)
    return res
      .status(503)
      .json({ error: "Blockchain connection not available." });
  try {
    const { examID } = req.params;
    const examData = await contract.getExamResult(examID);
    res.json({
      resultHash: examData[0],
      resultURL: examData[1], // This field was added to the contract
      resultTimestamp: examData[2].toString(),
      isResultUploaded: examData[3],
    });
  } catch (err) {
    console.error("--- ERROR IN /getExamResult ---", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/my-result", async (req, res) => {
  if (!contract)
    return res
      .status(503)
      .json({ error: "Blockchain connection not available." });
  const { examID, attemptHash } = req.query;
  if (!examID || !attemptHash) {
    return res
      .status(400)
      .json({ error: "Exam ID and Attempt Hash are required." });
  }
  try {
    const exam = await contract.exams(examID);
    const resultsURL = exam.resultURL;
    if (!resultsURL) {
      return res
        .status(404)
        .json({ error: "Results have not been published for this exam yet." });
    }
    const response = await axios.get(resultsURL);
    const csvData = response.data;
    const records = parse(csvData, { columns: true, skip_empty_lines: true });
    const studentResult = records.find(
      (record) => record.attemptHash === attemptHash
    );
    if (studentResult) {
      res.json(studentResult);
    } else {
      res.status(404).json({
        error: "Your attempt hash was not found in the results file.",
      });
    }
  } catch (err) {
    console.error("Error in /my-result:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- NEW CUSTOM EXAM APIS ----

app.post("/api/save-exam", (req, res) => {
  try {
    const examData = req.body;
    const examId = randomUUID();
    examData.id = examId;
    examData.scheduled = false; // Add a flag to track blockchain status
    const filePath = path.join(EXAMS_DIR, `${examId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(examData, null, 2));
    res.status(201).json({ message: "Exam saved successfully", examId });
  } catch (error) {
    console.error("Error saving exam:", error);
    res.status(500).json({ error: "Failed to save exam" });
  }
});

// NEW: Get all exams (scheduled and unscheduled)
app.get("/api/all-exams", (req, res) => {
  try {
    const allFiles = fs.readdirSync(EXAMS_DIR);
    const jsonFiles = allFiles.filter((file) => file.endsWith(".json"));
    const allExams = jsonFiles.map((file) => {
      const filePath = path.join(EXAMS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath));
      return data;
    });

    res.json(allExams);
  } catch (error) {
    console.error("Error fetching all exams:", error);
    res.status(500).json({ error: "Failed to fetch exams" });
  }
});

app.get("/api/unscheduled-exams", (req, res) => {
  try {
    const allFiles = fs.readdirSync(EXAMS_DIR);
    const jsonFiles = allFiles.filter((file) => file.endsWith(".json"));
    const unscheduledExams = jsonFiles
      .map((file) => {
        const filePath = path.join(EXAMS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath));
        return data;
      })
      .filter((exam) => !exam.scheduled);

    res.json(unscheduledExams);
  } catch (error) {
    console.error("Error fetching unscheduled exams:", error);
    res.status(500).json({ error: "Failed to fetch unscheduled exams" });
  }
});

app.get("/api/exams/:id", (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(EXAMS_DIR, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Exam not found." });
    }

    const examData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json(examData);
  } catch (error) {
    console.error(`Error fetching exam ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to fetch exam data." });
  }
});

// MODIFIED: Submit test endpoint now performs instant grading
app.post("/api/submit-test", (req, res) => {
  try {
    const { examID, attemptHash, answers } = req.body; // examID is the file UUID

    if (!examID || !attemptHash || !answers) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // --- INSTANT GRADING LOGIC ---
    const examFilePath = path.join(EXAMS_DIR, `${examID}.json`);
    if (!fs.existsSync(examFilePath)) {
      throw new Error("Exam data not found. Cannot grade.");
    }
    const examData = JSON.parse(fs.readFileSync(examFilePath, "utf-8"));

    let score = 0;
    const total = examData.questions.length;

    examData.questions.forEach((question, index) => {
      const studentAnswer = answers[index];
      const correctAnswer = question.correctAnswer;

      if (question.type === "MCQ" || question.options) {
        if (parseInt(studentAnswer) === parseInt(correctAnswer)) {
          score++;
        }
      } else if (question.type === "TrueFalse") {
        if (
          String(studentAnswer).toLowerCase() ===
          String(correctAnswer).toLowerCase()
        ) {
          score++;
        }
      } else {
        if (
          String(studentAnswer).trim().toLowerCase() ===
          String(correctAnswer).trim().toLowerCase()
        ) {
          score++;
        }
      }
    });
    const percentage = Math.round((score / total) * 100);
    // --- END GRADING LOGIC ---

    // Create submissions directory for this exam if it doesn't exist
    const examSubmissionsDir = path.join(SUBMISSIONS_DIR, examID);
    if (!fs.existsSync(examSubmissionsDir)) {
      fs.mkdirSync(examSubmissionsDir, { recursive: true });
    }

    // Save the submission WITH the score
    const submissionData = {
      attemptHash,
      answers,
      timestamp: new Date().toISOString(),
      score: score,
      total: total,
      percentage: percentage,
    };

    const submissionFile = path.join(examSubmissionsDir, `${attemptHash}.json`);
    fs.writeFileSync(submissionFile, JSON.stringify(submissionData, null, 2));

    res.json({
      status: "success",
      message: "Test submitted and graded successfully",
      attemptHash,
    });
  } catch (error) {
    console.error(`Error submitting test:`, error);
    res
      .status(500)
      .json({ error: `Failed to process submission. ${error.message}` });
  }
});

// NEW: Get provisional (non-published) result for a single student
app.get("/api/get-provisional-result", (req, res) => {
  const { examName, attemptHash } = req.query; // examName is the string name
  if (!examName || !attemptHash) {
    return res.status(400).json({ error: "Missing examName or attemptHash" });
  }

  try {
    // Find the exam file ID (UUID) from the exam name
    const examFileId = findExamFileIdByName(examName);
    if (!examFileId) {
      return res.status(404).json({ error: "Exam not found by name." });
    }

    const submissionFile = path.join(
      SUBMISSIONS_DIR,
      examFileId, // Use the UUID to find the folder
      `${attemptHash}.json`
    );

    if (!fs.existsSync(submissionFile)) {
      return res.status(404).json({ error: "Submission not found." });
    }

    const submissionData = JSON.parse(fs.readFileSync(submissionFile, "utf-8"));

    // --- FIX START: Check if score is missing. If so, grade it now. ---
    if (
      submissionData.score === undefined ||
      submissionData.total === undefined
    ) {
      console.log(`Grading provisional submission for ${attemptHash}...`);
      const examFilePath = path.join(EXAMS_DIR, `${examFileId}.json`);
      if (!fs.existsSync(examFilePath)) {
        throw new Error("Exam data not found. Cannot grade.");
      }
      const examData = JSON.parse(fs.readFileSync(examFilePath, "utf-8"));

      let score = 0;
      const total = examData.questions.length;

      examData.questions.forEach((question, index) => {
        const studentAnswer = submissionData.answers[index];
        const correctAnswer = question.correctAnswer;

        if (question.type === "MCQ" || question.options) {
          if (parseInt(studentAnswer) === parseInt(correctAnswer)) {
            score++;
          }
        } else if (question.type === "TrueFalse") {
          if (
            String(studentAnswer).toLowerCase() ===
            String(correctAnswer).toLowerCase()
          ) {
            score++;
          }
        } else {
          if (
            String(studentAnswer).trim().toLowerCase() ===
            String(correctAnswer).trim().toLowerCase()
          ) {
            score++;
          }
        }
      });
      const percentage = Math.round((score / total) * 100);

      // Update the submissionData object
      submissionData.score = score;
      submissionData.total = total;
      submissionData.percentage = percentage;

      // Re-save the file with the new score
      fs.writeFileSync(submissionFile, JSON.stringify(submissionData, null, 2));
      console.log(`...Grading complete. Saved score to file.`);
    }
    // --- FIX END ---

    // Now, the submissionData is guaranteed to have a score
    res.json({
      attemptHash: submissionData.attemptHash,
      score: submissionData.score,
      total: submissionData.total,
      percentage: submissionData.percentage,
      timestamp: submissionData.timestamp,
      provisional: true, // Add a flag to indicate this isn't final
    });
  } catch (error) {
    console.error("Error fetching provisional result:", error);
    res.status(500).json({ error: "Failed to fetch provisional result." });
  }
});

// Legacy endpoint for backward compatibility
app.post("/api/submit-exam/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;
    const filePath = path.join(EXAMS_DIR, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Exam not found." });
    }

    const examData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    let score = 0;
    examData.questions.forEach((question, index) => {
      if (question.correctAnswer === answers[index]) {
        score++;
      }
    });

    res.json({ score, total: examData.questions.length });
  } catch (error) {
    console.error(`Error submitting exam ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to process submission." });
  }
});

// NEW: Grade exam endpoint
app.post("/api/grade-exam/:id", (req, res) => {
  try {
    const { id } = req.params; // This is the exam file ID (e.g., 8fce1921-...)

    // Load exam data
    const examFilePath = path.join(EXAMS_DIR, `${id}.json`);
    if (!fs.existsSync(examFilePath)) {
      return res.status(404).json({ error: "Exam not found." });
    }

    const examData = JSON.parse(fs.readFileSync(examFilePath, "utf-8"));
    const examIDForResults = examData.examName || examData.title || examData.id;

    // Load all submissions for this exam
    const examSubmissionsDir = path.join(SUBMISSIONS_DIR, id); // Use the ID

    if (!fs.existsSync(examSubmissionsDir)) {
      return res
        .status(404)
        .json({ error: "No submissions found for this exam." });
    }

    const submissionFiles = fs.readdirSync(examSubmissionsDir);

    if (submissionFiles.length === 0) {
      return res
        .status(404)
        .json({ error: "No submissions found for this exam." });
    }

    // Grade all submissions
    const results = [];

    submissionFiles.forEach((file) => {
      const submissionPath = path.join(examSubmissionsDir, file);
      const submission = JSON.parse(fs.readFileSync(submissionPath, "utf-8"));

      // Use the pre-calculated score if it exists
      if (submission.score !== undefined) {
        results.push({
          attemptHash: submission.attemptHash,
          score: submission.score,
          total: submission.total,
          percentage: submission.percentage,
          submittedAt: submission.timestamp,
        });
      } else {
        // Fallback for any old submissions that weren't auto-graded
        let score = 0;
        const total = examData.questions.length;
        examData.questions.forEach((question, index) => {
          const studentAnswer = submission.answers[index];
          const correctAnswer = question.correctAnswer;
          if (question.type === "MCQ" || question.options) {
            if (parseInt(studentAnswer) === parseInt(correctAnswer)) {
              score++;
            }
          }
          // (add other question types if needed)
        });
        const percentage = Math.round((score / total) * 100);
        results.push({
          attemptHash: submission.attemptHash,
          score: score,
          total: total,
          percentage: percentage,
          submittedAt: submission.timestamp,
        });
      }
    });

    // Save results file
    const resultsFileName = `${examIDForResults.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_results.json`;
    const resultsFilePath = path.join(RESULTS_DIR, resultsFileName);
    fs.writeFileSync(resultsFilePath, JSON.stringify(results, null, 2));

    // Generate hash of results file
    const resultsContent = fs.readFileSync(resultsFilePath, "utf-8");
    const hash = crypto
      .createHash("sha256")
      .update(resultsContent)
      .digest("hex");
    const hashWithPrefix = "0x" + hash;

    // Generate URL (assuming backend is accessible)
    const resultsURL = `${
      process.env.BACKEND_URL || "http://localhost:3200"
    }/api/results/${resultsFileName}`;

    console.log(
      `Graded ${results.length} submissions for exam: ${examIDForResults}`
    );
    console.log(`Results saved to: ${resultsFilePath}`);
    console.log(`Results hash: ${hashWithPrefix}`);
    console.log(`Results URL: ${resultsURL}`);

    res.json({
      status: "success",
      message: `Graded ${results.length} submission(s)`,
      examID: examIDForResults, // Use the name/title for the response
      resultsCount: results.length,
      url: resultsURL,
      hash: hashWithPrefix,
      resultsFile: resultsFileName,
    });
  } catch (error) {
    console.error(`Error grading exam ${req.params.id}:`, error);
    res.status(500).json({ error: `Failed to grade exam: ${error.message}` });
  }
});

// NEW: Serve results files
app.get("/api/results/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(RESULTS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Results file not found." });
    }

    const resultsData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json(resultsData);
  } catch (error) {
    console.error(`Error fetching results file ${req.params.filename}:`, error);
    res.status(500).json({ error: "Failed to fetch results file." });
  }
});

// --- Server Startup Logic ---
const PORT = process.env.PORT || 3200;

async function startServer() {
  try {
    console.log("Attempting to connect to the blockchain...");
    provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_URL);
    const network = await provider.getNetwork();
    console.log(
      `Successfully connected to network: ${network.name} (Chain ID: ${network.chainId})`
    );
    wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const artifact = JSON.parse(fs.readFileSync("./ShikshaChainABI.json"));
    const contractABI = artifact.abi;
    contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      contractABI,
      wallet
    );
    console.log(`Contract initialized at address: ${contract.address}`);
    console.log(`Signer (teacher) address: ${wallet.address}`);
    console.log(`\nDirectories:`);
    console.log(`  Exams: ${EXAMS_DIR}`);
    console.log(`  Submissions: ${SUBMISSIONS_DIR}`);
    console.log(`  Results: ${RESULTS_DIR}`);
    app.listen(PORT, () => {
      console.log(
        `✅ Backend server is running and connected to the blockchain on port ${PORT}`
      );
    });
  } catch (error) {
    console.error("❌ Failed to start server or connect to blockchain:");
    console.error(error.message);
    console.error("\nPlease check your .env file and network connection.");
    process.exit(1);
  }
}

startServer();
