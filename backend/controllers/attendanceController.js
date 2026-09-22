const Attendance = require("../models/Attendance");
const Student = require("../models/Student");

exports.markAttendance = async (req, res) => {
    try {
        const { studentId, confidence, markedBy } = req.body;
        
        if (!studentId || confidence == null) {
            return res.status(400).json({ error: "Student ID and confidence are required." });
        }

        const dateString = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

        // Check if attendance already marked for today
        const existingRecord = await Attendance.findOne({ studentId, date: dateString });
        if (existingRecord) {
            return res.status(200).json({ message: "Already marked present today", record: existingRecord });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ error: "Student not found." });
        }

        const newAttendance = new Attendance({
            studentId,
            date: dateString,
            time: new Date(),
            status: "present",
            confidence,
            markedBy: markedBy || "face"
        });

        await newAttendance.save();
        
        // Emit socket event (req.io is attached in server.js)
        if (req.io) {
            req.io.emit("attendance:marked", {
                studentName: student.name,
                rollNo: student.rollNo,
                class: student.class,
                time: newAttendance.time,
                confidence,
                markedBy: newAttendance.markedBy
            });
        }

        res.status(201).json({ message: `Successfully marked attendance for ${student.name}`, record: newAttendance });
    } catch (error) {
        console.error("Error marking attendance:", error);
        res.status(500).json({ error: "Server error marking attendance." });
    }
};

exports.getAttendance = async (req, res) => {
    try {
        const { date, studentClass } = req.query;
        let query = {};
        
        if (date) {
            query.date = date;
        }

        const records = await Attendance.find(query).populate('studentId', 'name rollNo class');
        
        let filteredRecords = records;
        let totalEnrolled = 0;

        // Filter by class if provided and get total enrolled for that class
        if (studentClass) {
            filteredRecords = records.filter(record => record.studentId && record.studentId.class === studentClass);
            totalEnrolled = await Student.countDocuments({ class: studentClass });
        } else {
            // Get total enrolled across all classes
            totalEnrolled = await Student.countDocuments();
        }

        res.json({
            records: filteredRecords,
            totalEnrolled
        });
    } catch (error) {
        console.error("Error fetching attendance:", error);
        res.status(500).json({ error: "Server error fetching attendance." });
    }
};
