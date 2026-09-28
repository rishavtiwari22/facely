const express = require('express');
const app = express();
app.use((req, res, next) => {
    console.log("Before: req.url=", req.url, "req.query=", req.query);
    req.url = req.url.replace(/\/{2,}/g, '/');
    console.log("After: req.url=", req.url, "req.query=", req.query);
    next();
});
app.get('/api/test', (req, res) => {
    res.json(req.query);
});
app.listen(5556, () => console.log("running"));
