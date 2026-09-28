const mongoose = require("mongoose");
const Student = require("./models/Student.js");

mongoose.connect("mongodb+srv://rishav_db_user:45uxAnfwUhT608Ek@cluster0.pfoovgs.mongodb.net/facely?appName=Cluster0").then(async () => {
    const students = await Student.find({campus: "Eternal Campus"});
    console.log(`Found ${students.length} students in Eternal Campus`);
    let valid = 0;
    for (let s of students) {
        if (s.embeddings && s.embeddings.length > 0) valid++;
    }
    console.log(`Valid face data count: ${valid}`);
    process.exit(0);
}).catch(console.error);
