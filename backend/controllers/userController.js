const AdminUser = require("../models/AdminUser");

exports.getAllUsers = async (req, res) => {
    try {
        const users = await AdminUser.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, email, role, campus } = req.body;
        
        if (!email || !['staff', 'superadmin'].includes(role)) {
            return res.status(400).json({ error: "Valid email and role are required" });
        }

        const existing = await AdminUser.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.status(400).json({ error: "User already exists" });
        }

        const newUser = await AdminUser.create({
            email,
            role,
            campus: campus || null,
            name: name || ''
        });

        res.status(201).json({ message: "User created successfully", user: newUser });
    } catch (err) {
        console.error("Error creating user:", err);
        res.status(500).json({ error: "Failed to create user" });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, campus } = req.body;

        if (!['pending', 'staff', 'superadmin'].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const targetUser = await AdminUser.findById(id);
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }

        if (targetUser.email === 'rishav@navgurukul.org') {
            return res.status(403).json({ error: "This core superadmin account cannot be modified." });
        }

        const user = await AdminUser.findByIdAndUpdate(
            id,
            { name, email, role, campus: campus || null },
            { new: true }
        );

        res.json({ message: "User updated successfully", user });
    } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).json({ error: "Failed to update user" });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const targetUser = await AdminUser.findById(id);
        
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }

        if (targetUser.email === 'rishav@navgurukul.org') {
            return res.status(403).json({ error: "This core superadmin account cannot be deleted." });
        }

        await AdminUser.findByIdAndDelete(id);
        
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({ error: "Failed to delete user" });
    }
};