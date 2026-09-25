const CampusConfig = require('../models/CampusConfig');

exports.getAllConfigs = async (req, res) => {
    try {
        const configs = await CampusConfig.find();
        res.json(configs);
    } catch (error) {
        console.error("Error fetching configs:", error);
        res.status(500).json({ error: "Server error fetching configurations." });
    }
};

exports.updateConfig = async (req, res) => {
    try {
        const { campusName, slots, classes } = req.body;

        if (!campusName || !Array.isArray(slots)) {
            return res.status(400).json({ error: "campusName and slots array are required." });
        }

        const sanitizedCampusName = String(campusName).trim();

        // Sanitize classes array
        const sanitizedClasses = Array.isArray(classes)
            ? classes.map(c => String(c).trim()).filter(Boolean)
            : [];

        const updatedConfig = await CampusConfig.findOneAndUpdate(
            { campusName: sanitizedCampusName },
            { 
                slots, 
                classes: sanitizedClasses
            },
            { new: true, upsert: true }
        );

        res.json(updatedConfig);
    } catch (error) {
        console.error("Error updating config:", error);
        res.status(500).json({ error: "Server error updating configuration." });
    }
};

exports.deleteConfig = async (req, res) => {
    try {
        const { campusName } = req.params;

        if (!campusName) {
            return res.status(400).json({ error: "campusName parameter is required." });
        }

        const deletedConfig = await CampusConfig.findOneAndDelete({ campusName });

        if (!deletedConfig) {
            return res.status(404).json({ error: "Configuration not found." });
        }

        res.json({ message: "Configuration deleted successfully.", deletedConfig });
    } catch (error) {
        console.error("Error deleting config:", error);
        res.status(500).json({ error: "Server error deleting configuration." });
    }
};
