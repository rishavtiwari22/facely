const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

router.get('/', configController.getAllConfigs);
router.post('/', configController.updateConfig);
router.delete('/:campusName', configController.deleteConfig);

module.exports = router;
