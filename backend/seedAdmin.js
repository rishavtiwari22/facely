require('dotenv').config();
const mongoose = require('mongoose');
const AdminUser = require('./models/AdminUser');

// IMPORTANT: Replace with your actual Google email
const YOUR_EMAIL = "rishav@navgurukul.org"; 

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log("Connected to MongoDB.");
    
    // Check if exists
    const existing = await AdminUser.findOne({ email: YOUR_EMAIL });
    if (existing) {
        console.log(`Admin ${YOUR_EMAIL} already exists in the allowlist.`);
    } else {
        await AdminUser.create({
            email: YOUR_EMAIL,
            name: "Super Admin",
            role: "superadmin"
        });
        console.log(`Successfully added ${YOUR_EMAIL} to the Admin allowlist!`);
    }

    process.exit(0);
}).catch(err => {
    console.error("Database connection error:", err);
    process.exit(1);
});
