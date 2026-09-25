const express = require("express");
const router = express.Router();
const { markAttendance, getAttendance, bulkMarkAttendance, getDashboardAggregate, deleteAttendance, manualMarkAttendance } = require("../controllers/attendanceController");

const authMiddleware = require("../middleware/authMiddleware");

router.get("/aggregate", authMiddleware, getDashboardAggregate);
router.post("/mark", authMiddleware, markAttendance);
router.post("/manual", authMiddleware, manualMarkAttendance);
router.delete("/:id", authMiddleware, deleteAttendance);
router.post("/bulk", authMiddleware, bulkMarkAttendance);
router.get("/", authMiddleware, getAttendance);

module.exports = router;
