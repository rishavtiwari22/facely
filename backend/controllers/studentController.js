const Student = require("../models/Student");
const Attendance = require("../models/Attendance");

const calculateEuclideanDistance = (descriptor1, descriptor2) => {
    let sum = 0;
    for (let i = 0; i < descriptor1.length; i++) {
        const diff = descriptor1[i] - descriptor2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
};

exports.registerStudent = async (req, res) => {
    try {
        const { name, rollNo, studentClass, embeddings, schoolEmail, campus } = req.body;

        if (!name || !rollNo || !studentClass || !embeddings || !schoolEmail || !campus || embeddings.length === 0) {
            return res.status(400).json({ error: "All fields (name, rollNo, class, email, campus) and embeddings are required." });
        }

        // ── Embedding Validation (prevents memory exhaustion attacks) ──
        if (!Array.isArray(embeddings) || embeddings.length < 3 || embeddings.length > 20) {
            return res.status(400).json({ error: `Embeddings must be between 3 and 20 captures. Received: ${Array.isArray(embeddings) ? embeddings.length : 'invalid'}.` });
        }
        for (const emb of embeddings) {
            if (!Array.isArray(emb) || emb.length !== 128 || emb.some(v => typeof v !== 'number' || !isFinite(v))) {
                return res.status(400).json({ error: "Each embedding must be an array of exactly 128 finite numbers." });
            }
        }

        // ── Sanitize string inputs ──
        const sanitizedName = String(name).trim().slice(0, 100);
        const sanitizedRollNo = String(rollNo).trim().slice(0, 50);
        const sanitizedCampus = String(campus).trim().slice(0, 100);
        const sanitizedEmail = String(schoolEmail).trim().toLowerCase().slice(0, 200);
        const sanitizedClass = String(studentClass).trim().slice(0, 50);

        const existingStudentByEmail = await Student.findOne({ schoolEmail: sanitizedEmail });
        if (existingStudentByEmail) {
            return res.status(400).json({ error: "Student with this school email already exists." });
        }

        const existingStudentByRoll = await Student.findOne({ rollNo: sanitizedRollNo, campus: sanitizedCampus });
        if (existingStudentByRoll) {
            return res.status(400).json({ error: `Student with roll number ${sanitizedRollNo} already exists in campus ${sanitizedCampus}.` });
        }

        // Check if the face is already registered (globally)
        const allStudents = await Student.find();
        let matchedStudent = null;
        const newDescriptor = embeddings[0]; // Use the first capture to check

        for (const student of allStudents) {
            for (const existingDescriptor of student.embeddings) {
                const distance = calculateEuclideanDistance(newDescriptor, existingDescriptor);
                if (distance < 0.55) { // 0.55 is our face matching threshold
                    matchedStudent = student;
                    break;
                }
            }
            if (matchedStudent) break;
        }

        if (matchedStudent) {
            return res.status(400).json({ 
                error: `This face is already registered to ${matchedStudent.name} (Roll No: ${matchedStudent.rollNo}, Campus: ${matchedStudent.campus}).` 
            });
        }

        const newStudent = new Student({
            name: sanitizedName,
            schoolEmail: sanitizedEmail,
            campus: sanitizedCampus,
            rollNo: sanitizedRollNo,
            class: sanitizedClass,
            embeddings,
        });

        await newStudent.save();
        res.status(201).json({ message: "Student registered successfully", student: newStudent });
    } catch (error) {
        console.error("Error registering student:", error);
        res.status(500).json({ error: "Server error during registration." });
    }
};

exports.getAllStudents = async (req, res) => {
    try {
        const queryObj = {};
        
        // Isolate by staff's assigned campus
        if (req.user && req.user.role === 'staff' && req.user.campus) {
            queryObj.campus = req.user.campus;
        } else if (req.query.campus) {
            queryObj.campus = String(req.query.campus);
        }

        let query = Student.find(queryObj);
        
        // Exclude massive embeddings array by default to speed up Home page loading
        if (req.query.includeEmbeddings !== 'true') {
            query = query.select('-embeddings');
        }
        
        const students = await query;
        res.json(students);
    } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({ error: "Server error fetching students." });
    }
};

exports.updateStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, rollNo, campus, schoolEmail, studentClass } = req.body;

        const updateData = {};
        if (name) updateData.name = String(name).trim().slice(0, 100);
        if (rollNo) updateData.rollNo = String(rollNo).trim().slice(0, 50);
        if (campus) updateData.campus = String(campus).trim().slice(0, 100);
        if (schoolEmail) updateData.schoolEmail = String(schoolEmail).trim().toLowerCase().slice(0, 200);
        if (studentClass) updateData.class = String(studentClass).trim().slice(0, 50);

        const student = await Student.findByIdAndUpdate(id, updateData, { new: true });
        
        if (!student) {
            return res.status(404).json({ error: "Student not found." });
        }

        res.json({ message: "Student updated successfully.", student });
    } catch (error) {
        console.error("Error updating student:", error);
        res.status(500).json({ error: "Server error updating student." });
    }
};

exports.appendEmbeddings = async (req, res) => {
    try {
        const { id } = req.params;
        const { embeddings } = req.body;

        if (!embeddings || embeddings.length === 0) {
            return res.status(400).json({ error: "Embeddings are required." });
        }

        // ── Embedding Validation ──
        if (!Array.isArray(embeddings) || embeddings.length > 10) {
            return res.status(400).json({ error: "Can append a maximum of 10 embeddings at a time." });
        }
        for (const emb of embeddings) {
            if (!Array.isArray(emb) || emb.length !== 128 || emb.some(v => typeof v !== 'number' || !isFinite(v))) {
                return res.status(400).json({ error: "Each embedding must be an array of exactly 128 finite numbers." });
            }
        }

        const student = await Student.findById(id);
        if (!student) {
            return res.status(404).json({ error: "Student not found." });
        }

        // ── Cap total embeddings per student at 20 to prevent bloat ──
        if (student.embeddings.length + embeddings.length > 20) {
            return res.status(400).json({ error: `Cannot exceed 20 total face captures per student. Current: ${student.embeddings.length}.` });
        }

        // Append the new embeddings to the existing ones
        student.embeddings = [...student.embeddings, ...embeddings];
        await student.save();

        res.json({ message: "Successfully added face data.", student });
    } catch (error) {
        console.error("Error appending embeddings:", error);
        res.status(500).json({ error: "Server error appending embeddings." });
    }
};

exports.deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;
        
        const student = await Student.findByIdAndDelete(id);
        if (!student) {
            return res.status(404).json({ error: "Student not found." });
        }
        
        // Also delete their attendance records
        await Attendance.deleteMany({ studentId: id });
        
        res.json({ message: "Student deleted successfully." });
    } catch (error) {
        console.error("Error deleting student:", error);
        res.status(500).json({ error: "Server error deleting student." });
    }
};
