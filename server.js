// Import necessary modules
const express = require('express');
const path = require('path');

// Create an Express application instance
const app = express();
// Define the port the server will listen on. You can change this if needed.
const port = 3000;

// Serve static files from the 'public' directory
// When a request comes in, Express will first look for the file in the 'public' directory.
// For example, a request for '/style.css' will serve 'web_ray_tracer/public/style.css'.
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route to serve index.html for any other requests.
// This is useful for single-page applications where client-side routing is used.
app.get('*', (req, res) => {
    // Send the index.html file located in the 'public' directory
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server and listen for incoming requests on the specified port
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Serving static files from: ${path.join(__dirname, 'public')}`);
});
