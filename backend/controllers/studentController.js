const Student = require("../models/Student");

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
        const { name, rollNo, studentClass, embeddings } = req.body;

        if (!name || !rollNo || !studentClass || !embeddings || embeddings.length === 0) {
            return res.status(400).json({ error: "All fields and embeddings are required." });
        }

        const existingStudent = await Student.findOne({ rollNo });
        if (existingStudent) {
            return res.status(400).json({ error: "Student with this roll number already exists." });
        }

        // Check if the face is already registered
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
                error: `This face is already registered to ${matchedStudent.name} (Roll No: ${matchedStudent.rollNo}).` 
            });
        }

        const newStudent = new Student({
            name,
            rollNo,
            class: studentClass,
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
        let query = Student.find();
        
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

exports.appendEmbeddings = async (req, res) => {
    try {
        const { id } = req.params;
        const { embeddings } = req.body;

        if (!embeddings || embeddings.length === 0) {
            return res.status(400).json({ error: "Embeddings are required." });
        }

        const student = await Student.findById(id);
        if (!student) {
            return res.status(404).json({ error: "Student not found." });
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
