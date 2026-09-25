const express = require("express");
const router = express.Router();
const { getAllUsers, updateUser, createUser, deleteUser } = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

// Require superadmin for these actions
const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: "Only superadmins can perform this action" });
    }
    next();
};

router.get("/", authMiddleware, requireSuperAdmin, getAllUsers);
router.post("/", authMiddleware, requireSuperAdmin, createUser);
router.patch("/:id", authMiddleware, requireSuperAdmin, updateUser);
router.delete("/:id", authMiddleware, requireSuperAdmin, deleteUser);

module.exports = router;