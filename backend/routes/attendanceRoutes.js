const express = require("express");
const router = express.Router();
const { markAttendance, getAttendance } = require("../controllers/attendanceController");

router.post("/mark", markAttendance);
router.get("/", getAttendance);

module.exports = router;
