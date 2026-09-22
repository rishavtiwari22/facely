const express = require("express");
const router = express.Router();
const { registerStudent, getAllStudents, appendEmbeddings } = require("../controllers/studentController");

router.post("/register", registerStudent);
router.get("/", getAllStudents);
router.patch("/:id/embeddings", appendEmbeddings);

module.exports = router;
