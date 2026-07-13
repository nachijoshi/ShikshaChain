// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ShikshaChain
 * @dev Manages the lifecycle of an online examination system with enhanced data structures.
 */
contract ShikshaChain {
    address public owner;

    // --- STRUCT DEFINITION (without mappings) ---
    // This new struct holds only simple data types, so it CAN be returned from external functions.
    struct ExamInfo {
        string examID;
        string formLink;
        uint256 startTime;
        uint256 endTime;
        string resultHash;
        string resultURL;
        uint256 resultTimestamp;
        bool isResultUploaded;
    }

    // --- STATE VARIABLES ---
    
    // This mapping now uses the "light" ExamInfo struct.
    mapping(string => ExamInfo) public exams;

    // The mappings that were inside the struct are now top-level, nested mappings.
    // This is the standard pattern for this kind of data relationship.
    mapping(string => mapping(address => bool)) public registeredStudents;
    mapping(string => mapping(address => string)) public attemptHashes;

    string[] public examIDs;

    // --- EVENTS (no change) ---
    event ExamCreated(string indexed examID, uint256 startTime, uint256 endTime);
    event StudentsRegistered(string indexed examID, uint256 count);
    event AttemptHashGenerated(string indexed examID, address indexed student, string attemptHash);
    event ResultStored(string indexed examID, string resultHash, string resultURL);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action.");
        _;
    }

    function createExam(string calldata _examID, string calldata _formLink, uint256 _startTime, uint256 _endTime) external onlyOwner {
        require(bytes(exams[_examID].examID).length == 0, "Exam with this ID already exists.");
        require(_startTime < _endTime, "Start time must be before end time.");
        
        exams[_examID] = ExamInfo({
            examID: _examID,
            formLink: _formLink,
            startTime: _startTime,
            endTime: _endTime,
            resultHash: "",
            resultURL: "",
            resultTimestamp: 0,
            isResultUploaded: false
        });
        
        examIDs.push(_examID);
        emit ExamCreated(_examID, _startTime, _endTime);
    }

    function registerStudents(string calldata _examID, address[] calldata _studentAddresses) external onlyOwner {
        require(bytes(exams[_examID].examID).length > 0, "Exam does not exist.");
        for (uint i = 0; i < _studentAddresses.length; i++) {
            // Updated to use the new top-level mapping
            registeredStudents[_examID][_studentAddresses[i]] = true;
        }
        emit StudentsRegistered(_examID, _studentAddresses.length);
    }

    function generateAttemptHash(string calldata _examID) external {
        ExamInfo storage currentExam = exams[_examID];
        require(bytes(currentExam.examID).length > 0, "Exam does not exist.");
        // Updated to use the new top-level mappings
        require(registeredStudents[_examID][msg.sender], "Student is not registered for this exam.");
        require(block.timestamp >= currentExam.startTime && block.timestamp <= currentExam.endTime, "Exam is not active.");
        require(bytes(attemptHashes[_examID][msg.sender]).length == 0, "Attempt hash already generated.");

        string memory attemptHash = bytesToHex(keccak256(abi.encodePacked(_examID, msg.sender, block.timestamp)));
        attemptHashes[_examID][msg.sender] = attemptHash;

        emit AttemptHashGenerated(_examID, msg.sender, attemptHash);
    }

    function storeResult(string calldata _examID, string calldata _resultHash, string calldata _resultURL) external onlyOwner {
        require(bytes(exams[_examID].examID).length > 0, "Exam does not exist.");
        
        exams[_examID].resultHash = _resultHash;
        exams[_examID].resultURL = _resultURL;
        exams[_examID].resultTimestamp = block.timestamp;
        exams[_examID].isResultUploaded = true;

        emit ResultStored(_examID, _resultHash, _resultURL);
    }
    
    // --- CORRECTED FUNCTION ---
    // This function now returns ExamInfo[] and will compile successfully.
    function getAllExams() external view returns (ExamInfo[] memory) {
        ExamInfo[] memory allExams = new ExamInfo[](examIDs.length);
        for(uint i = 0; i < examIDs.length; i++){
            allExams[i] = exams[examIDs[i]];
        }
        return allExams;
    }

    function getExamResult(string calldata _examID) external view returns (string memory resultHash, uint256 resultTimestamp, bool isResultUploaded) {
        require(bytes(exams[_examID].examID).length > 0, "Exam does not exist.");
        ExamInfo storage exam = exams[_examID];
        return (exam.resultHash, exam.resultTimestamp, exam.isResultUploaded);
    }

    function bytesToHex(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint i = 0; i < 32; i++) {
            str[i * 2] = alphabet[uint8(data[i] >> 4)];
            str[i * 2 + 1] = alphabet[uint8(data[i] & 0x0F)];
        }
        return string(str);
    }
}