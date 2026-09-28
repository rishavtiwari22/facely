const mongoose = require("mongoose");
const AdminUser = require("./models/AdminUser.js");
const jwt = require("jsonwebtoken");
require("dotenv").config({path: "./.env"});

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const admin = await AdminUser.findOne({role: "superadmin"});
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role, campus: admin.campus },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log("Token generated, testing API...");
    try {
        const res = await fetch("http://localhost:5555/api/students?includeEmbeddings=true&campus=Eternal%20Campus", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const students = await res.json();
        console.log(`Received ${students.length} students`);
        if (students.length > 0) {
            console.log("Has embeddings:", !!students[0].embeddings);
        }
    } catch(err) {
        console.error("API Error:", err.message);
    }
    process.exit(0);
}).catch(console.error);
