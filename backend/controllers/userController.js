const User = require("../models/User");

const getUsers = async (req, res) => {
    res.json({ message: "Hello from user controller" });
};

const createUser = async (req, res) => {
    res.json({ message: "Hello from user controller" });
};

module.exports = {
    getUsers,
    createUser,
};