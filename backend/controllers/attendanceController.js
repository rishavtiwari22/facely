const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const CampusConfig = require("../models/CampusConfig");
const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redisOptions = { enableOfflineQueue: false, maxRetriesPerRequest: 0, retryStrategy: () => null };
const redisClient = new Redis(redisUrl, redisOptions);

redisClient.on("error", () => { });

exports.markAttendance = async (req, res) => {
    try {
        const { studentId, confidence, markedBy, slot } = req.body;

        if (!studentId || confidence == null || slot == null) {
            return res.status(400).json({ error: "Student ID, confidence, and slot are required." });
        }

        const dateString = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

        // Check if attendance already marked for today in this slot
        const existingRecord = await Attendance.findOne({ studentId, date: dateString, slot });
        if (existingRecord) {
            return res.status(200).json({ message: `Already marked present for slot ${slot} today`, record: existingRecord });
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
            markedBy: markedBy || "face",
            slot
        });

        await newAttendance.save();

        // Emit socket event (req.io is attached in server.js)
        if (req.io) {
            req.io.emit("attendance:marked", {
                studentName: student.name,
                rollNo: student.rollNo,
                class: student.class,
                campus: student.campus,
                time: newAttendance.time,
                confidence,
                markedBy: newAttendance.markedBy,
                slot
            });
        }

        res.status(201).json({ message: `Successfully marked attendance for ${student.name}`, record: newAttendance });
    } catch (error) {
        console.error("Error marking attendance:", error);
        res.status(500).json({ error: "Server error marking attendance." });
    }
};

exports.bulkMarkAttendance = async (req, res) => {
    try {
        const { records } = req.body; // Array of { studentId, confidence, markedBy, time }

        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ error: "Valid records array is required." });
        }

        const dateString = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

        // Validate that the slot exists for the campus (allows manual overrides)
        const studentIds = records.map(r => r.studentId);
        const students = await Student.find({ _id: { $in: studentIds } }).select('campus');
        const campusMap = new Map(students.map(s => [s._id.toString(), s.campus]));

        const configs = await CampusConfig.find();
        const configMap = new Map(configs.map(c => [c.campusName, c]));

        const validRecords = records.filter(record => {
            const campus = campusMap.get(record.studentId);
            if (!campus) return false;

            const config = configMap.get(campus);
            if (!config || !Array.isArray(config.slots) || config.slots.length === 0) return true; // allow defaults

            // Verify the selected slot actually exists in the campus configuration
            const slotObj = config.slots.find(s => s.slotNumber === record.slot);
            if (!slotObj) return false;

            if (slotObj.startTime && slotObj.endTime) {
                const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
                const recordTimeStr = new Intl.DateTimeFormat('en-GB', options).format(new Date(record.time || new Date()));
                if (recordTimeStr < slotObj.startTime || recordTimeStr > slotObj.endTime) {
                    return false; // Time is outside the slot window
                }
            }
            return true;
        });

        if (validRecords.length === 0) {
            return res.status(400).json({ error: "No valid records found or invalid slot selected." });
        }

        const documentsToInsert = validRecords.map(record => ({
            studentId: record.studentId,
            date: dateString,
            time: record.time || new Date(),
            status: "present",
            confidence: record.confidence || 1,
            markedBy: record.markedBy || "face",
            slot: record.slot || 1
        }));

        // Use insertMany with ordered: false to allow partial success (ignoring duplicate key errors for already marked students)
        let insertedDocs = [];
        try {
            insertedDocs = await Attendance.insertMany(documentsToInsert, { ordered: false });
        } catch (insertError) {
            // Error code 11000 is Duplicate Key (which we expect for already marked students)
            if (insertError.code !== 11000) {
                // If it's a different error, we throw it
                throw insertError;
            }
            // If it's just duplicates, insertError.insertedDocs contains the successful ones
            insertedDocs = insertError.insertedDocs || [];
        }

        // We could populate student info here, but for bulk it's often not needed
        // Emit socket event for dashboard updates
        if (req.io && insertedDocs.length > 0) {
            // We just notify that a bulk update occurred to trigger a refresh
            req.io.emit("attendance:bulk_marked", { count: insertedDocs.length });
        }

        res.status(201).json({
            message: `Successfully processed bulk attendance. ${insertedDocs.length} new records added.`,
            count: insertedDocs.length
        });
    } catch (error) {
        console.error("Error in bulk mark attendance:", error);
        res.status(500).json({ error: "Server error during bulk attendance mark." });
    }
};

exports.getAttendance = async (req, res) => {
    try {
        const { date, studentClass, campus, slot } = req.query;
        let query = {};

        if (date) {
            query.date = String(date);
        }
        if (slot !== undefined && slot !== null && slot !== '') {
            const parsedSlot = parseInt(String(slot), 10);
            if (!isNaN(parsedSlot)) {
                query.slot = parsedSlot;
            }
        }

        // We need to populate the studentId first to filter by campus if provided
        const records = await Attendance.find(query).populate('studentId', 'name rollNo class campus schoolEmail');

        let filteredRecords = records.filter(record => record.studentId); // Remove null references

        if (campus) {
            filteredRecords = filteredRecords.filter(record => record.studentId.campus === campus);
        }

        if (studentClass) {
            filteredRecords = filteredRecords.filter(record => record.studentId.class === studentClass);
        }

        // Calculate total enrolled based on filters
        const studentQuery = {};
        if (campus) studentQuery.campus = String(campus);
        if (studentClass) studentQuery.class = String(studentClass);

        const totalEnrolled = await Student.countDocuments(studentQuery);

        res.json({
            records: filteredRecords,
            totalEnrolled
        });
    } catch (error) {
        console.error("Error fetching attendance:", error);
        res.status(500).json({ error: "Server error fetching attendance." });
    }
};

exports.getDashboardAggregate = async (req, res) => {
    try {
        const dateString = req.query.date || new Date().toISOString().split("T")[0];

        let campusFilter = null;
        if (req.user && req.user.role === 'staff' && req.user.campus) {
            campusFilter = req.user.campus;
        }

        const cacheKey = campusFilter
            ? `dashboard_aggregate_${dateString}_${campusFilter}`
            : `dashboard_aggregate_${dateString}_global`;

        // Try Cache First
        const cachedData = await redisClient.get(cacheKey).catch(() => null);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        // Parallel DB Queries
        const studentQuery = campusFilter ? { campus: campusFilter } : {};
        const configQuery = campusFilter ? { campusName: campusFilter } : {};

        const [students, attendanceRecords, configs] = await Promise.all([
            Student.find(studentQuery).select('-embeddings'),
            Attendance.find({ date: dateString }).populate('studentId', 'name rollNo campus class'),
            CampusConfig.find(configQuery)
        ]);

        // Filter attendance records to only include those belonging to the isolated students
        const validStudentIds = new Set(students.map(s => s._id.toString()));
        const filteredAttendance = attendanceRecords.filter(r => r.studentId && validStudentIds.has(r.studentId._id.toString()));

        const responseData = {
            students,
            attendanceRecords: filteredAttendance,
            configs
        };

        // Cache for 2 seconds (short TTL for high concurrency read optimization)
        await redisClient.set(cacheKey, JSON.stringify(responseData), "EX", 2).catch(() => { });

        res.json(responseData);
    } catch (error) {
        console.error("Error in getDashboardAggregate:", error);
        res.status(500).json({ error: "Server error fetching aggregate dashboard data." });
    }
};

exports.deleteAttendance = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'superadmin') {
            return res.status(403).json({ error: "Only super admins can delete attendance records." });
        }

        const { id } = req.params;
        const deletedRecord = await Attendance.findByIdAndDelete(id);

        if (!deletedRecord) {
            return res.status(404).json({ error: "Attendance record not found." });
        }

        // We should ideally invalidate cache here, but it's 2-seconds TTL so it's okay.
        if (req.io) {
            req.io.emit("attendance:marked"); // emit generic event to trigger refetch
        }

        res.json({ message: "Attendance deleted successfully." });
    } catch (error) {
        console.error("Error deleting attendance:", error);
        res.status(500).json({ error: "Server error deleting attendance." });
    }
};

exports.manualMarkAttendance = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'superadmin') {
            return res.status(403).json({ error: "Only super admins can manually add attendance records." });
        }

        const { studentId, date, slot, status } = req.body;

        if (!studentId || !date || slot == null) {
            return res.status(400).json({ error: "Student ID, date, and slot are required." });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ error: "Student not found." });
        }

        // Check if attendance already marked for this date and slot
        const existingRecord = await Attendance.findOne({ studentId, date, slot });
        if (existingRecord) {
            return res.status(400).json({ error: `Attendance already marked for slot ${slot} on ${date}` });
        }

        const newAttendance = new Attendance({
            studentId,
            date,
            time: new Date(`${date}T12:00:00Z`), // Default time for manual mark
            status: status || "present",
            confidence: 1.0, // Manual mark implies 100% confidence
            markedBy: "manual",
            slot
        });

        await newAttendance.save();

        if (req.io) {
            req.io.emit("attendance:marked"); // emit generic event to trigger refetch
        }

        res.status(201).json({ message: `Successfully marked attendance manually for ${student.name}`, record: newAttendance });
    } catch (error) {
        console.error("Error in manualMarkAttendance:", error);
        res.status(500).json({ error: "Server error manually marking attendance." });
    }
};
