# ShikshaChain 🎓⛓️

A **secure, decentralized online examination system** built on the Ethereum blockchain. ShikshaChain ensures tamper-proof exam scheduling, student registration, attempt verification, and result storage — bringing trust and transparency to online assessments.

## Tech Stack

| Layer | Technology |
|---|---|
| **Smart Contract** | Solidity ^0.8.19, Hardhat |
| **Blockchain Network** | Ethereum Sepolia Testnet |
| **Backend** | Node.js, Express, ethers.js v5 |
| **Frontend** | Vanilla HTML/CSS/JS, Tailwind CSS (CDN) |
| **Wallet** | MetaMask |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────────┐
│    Frontend      │────▶│   Backend API    │────▶│  Ethereum (Sepolia)   │
│  (HTML/JS/CSS)   │     │  (Express.js)    │     │  ShikshaChain.sol     │
│                  │     │  Port 3200       │     │                       │
│  - Teacher Portal│     │  - Exam CRUD     │     │  - createExam()       │
│  - Student Portal│     │  - Grading       │     │  - registerStudents() │
│  - MetaMask      │     │  - File storage  │     │  - storeResult()      │
└─────────────────┘     └──────────────────┘     └───────────────────────┘
```

## Features

- **Teacher Portal** — Create exams with custom questions, schedule them on-chain, register students by wallet address, auto-grade submissions, and store result hashes on the blockchain.
- **Student Portal** — View available exams, take tests during the active window, generate on-chain attempt hashes, and verify results.
- **Blockchain Integrity** — Exam metadata, attempt hashes, and result hashes are stored immutably on Ethereum, preventing tampering.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [MetaMask](https://metamask.io/) browser extension
- Sepolia testnet ETH (get from a [faucet](https://sepoliafaucet.com/))
- An [Infura](https://infura.io/) account (for the Sepolia RPC URL)

## Setup & Running

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/ShikshaChain.git
cd ShikshaChain
```

### 2. Smart Contracts (optional — already deployed)

The contract is already deployed on Sepolia. Only follow these steps if you need to redeploy.

```bash
cd smart-contracts
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
# Edit .env and fill in your SEPOLIA_URL and PRIVATE_KEY
```

Compile and deploy:

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

> **Note:** If you redeploy, copy the new contract address into `backend/.env` as `CONTRACT_ADDRESS`.

### 3. Backend

```bash
cd backend
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
# Edit .env and fill in your credentials
```

Start the server:

```bash
npm start
```

The backend will start on `http://localhost:3200` and connect to the Sepolia blockchain.

### 4. Frontend

Serve the frontend with any static file server:

```bash
cd frontend
npx http-server -p 8080
```

Open `http://localhost:8080` in your browser and connect MetaMask (on Sepolia network).

## Environment Variables

### `backend/.env`

| Variable | Description |
|---|---|
| `PORT` | Server port (default: `3200`) |
| `SEPOLIA_URL` | Infura/Alchemy Sepolia RPC endpoint |
| `PRIVATE_KEY` | Private key of the contract owner (teacher) wallet |
| `CONTRACT_ADDRESS` | Deployed ShikshaChain contract address |

### `smart-contracts/.env`

| Variable | Description |
|---|---|
| `SEPOLIA_URL` | Infura/Alchemy Sepolia RPC endpoint |
| `PRIVATE_KEY` | Private key for deploying the contract |

## Project Structure

```
ShikshaChain/
├── backend/
│   ├── src/
│   │   ├── index.js           # Express API server
│   │   ├── exams/             # Exam data (runtime, gitignored)
│   │   ├── submissions/       # Student submissions (runtime, gitignored)
│   │   └── results/           # Grading results (runtime, gitignored)
│   ├── ShikshaChainABI.json   # Contract ABI artifact
│   ├── .env.example           # Environment template
│   └── package.json
├── frontend/
│   ├── index.html             # Landing page (portal selector)
│   ├── teacher.html           # Teacher dashboard
│   ├── student.html           # Student dashboard
│   ├── admin.html             # Admin page
│   ├── app.js                 # Shared frontend logic
│   ├── teacher.js             # Teacher portal logic
│   ├── student.js             # Student portal logic
│   └── styles.css
├── smart-contracts/
│   ├── contracts/
│   │   └── ShikshaChain.sol   # Main smart contract
│   ├── scripts/
│   │   └── deploy.js          # Deployment script
│   ├── hardhat.config.js
│   ├── .env.example           # Environment template
│   └── package.json
├── .gitignore
└── README.md
```

## Demo

🎥 https://youtu.be/G8gtW8o1oGc
