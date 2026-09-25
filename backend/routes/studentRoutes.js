const express = require("express");
const router = express.Router();
const { registerStudent, getAllStudents, appendEmbeddings, deleteStudent, updateStudent } = require("../controllers/studentController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/register", authMiddleware, registerStudent);
router.get("/", authMiddleware, getAllStudents);
router.patch("/:id", authMiddleware, updateStudent);
router.patch("/:id/embeddings", authMiddleware, appendEmbeddings);
router.delete("/:id", authMiddleware, deleteStudent);

module.exports = router;
