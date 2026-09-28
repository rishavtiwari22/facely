const mongoose = require("mongoose");
const AdminUser = require("./backend/models/AdminUser.js");
const jwt = require("jsonwebtoken");
require("dotenv").config({path: "./backend/.env"});

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const admin = await AdminUser.findOne({role: "superadmin"});
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role, campus: admin.campus },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log("Token generated, testing API...");
    const axios = require("axios");
    try {
        const res = await axios.get("http://localhost:5555/api/students?includeEmbeddings=true&campus=Eternal%20Campus", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const students = res.data;
        console.log(`Received ${students.length} students`);
        if (students.length > 0) {
            console.log("Has embeddings:", !!students[0].embeddings);
        }
    } catch(err) {
        console.error("API Error:", err.message);
        if (err.response) console.error(err.response.data);
    }
    process.exit(0);
}).catch(console.error);
