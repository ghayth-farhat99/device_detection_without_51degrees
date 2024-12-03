const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

mongoose.set('strictQuery', false);
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const csvFilePath = path.resolve('devices.csv');
const threshold = process.env.THRESHOLD;
//this line will solve the problem of running css and images 
app.use(express.static(path.join(__dirname, 'dist')));


// MongoDB connection
const start = async () => {
    try {
        // Connect to the database
        const tempConnection = await mongoose.connect(`${process.env.MONGODB_CONNECT_URL}/${process.env.MONGODB_DATABASE}`);

        // Fetch the THRESHOLD value from the configurations collection
        const configCollection = tempConnection.connection.db.collection('configurations');
        const config = await configCollection.findOne({ _id: 'threshold' });

        if (!config || isNaN(config.value)) {
            throw new Error('Invalid or missing THRESHOLD value in configurations collection.');
        }

        const threshold = parseInt(config.value, 10);

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`Threshold value set to: ${threshold}`);
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
};


// Device schema for MongoDB
const deviceSchema = new mongoose.Schema({
    isMobile: Boolean,
    hardwareModel: String,
    platform: String,
    platformVersion: String,
    ecoScore: Number,
    durability: Number,
    repairability: Number,
    recyclability: Number,
    climate_efficiency: Number,
    resource_efficiency: Number,
    onBase: Number,
}, { timestamps: true });

const Device = mongoose.model('devs', deviceSchema);

// Serve bienvenue_IHM.html for the root route
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', './pages/bienvenue/bienvenue_IHM.html'));
});

// CSV search function
function searchCsv(id) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(csvFilePath)) {
            resolve(null); // CSV file doesn't exist
            return;
        }

        const results = [];
        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (row) => {
                if (id.toLowerCase() === row['model_number_info'].toLowerCase()) {
                    results.push(row);
                }
            })
            .on('end', () => {
                resolve(results.length > 0 ? results[0] : null);
            })
            .on('error', (err) => {
                reject(err);
            });
    });
}

app.post('/', async (req, res) => {
    try {
        const deviceData = req.body;
        console.log('Received request body:', req.body); // Log the request body to verify the data
        const hardwareModel = deviceData.hardwareModel; // Assuming hardwareModel comes from the client request

        // Proceed with redirection logic
        if (!hardwareModel || hardwareModel.toLowerCase() !== 'unknown') {

            // search for the device info
            const deviceFromCsv = await searchCsv(hardwareModel);


            if (deviceFromCsv) {
            // Save the document to the database
                deviceData.onBase = 0;
                deviceData.ecoScore = parseInt(deviceFromCsv.eco_rating, 10);
                deviceData.durability = encodeURIComponent(deviceFromCsv.durability || '');
                deviceData.repairability = encodeURIComponent(deviceFromCsv.repairability || '');
                deviceData.recyclability = encodeURIComponent(deviceFromCsv.recyclability || '');
                deviceData.climate_efficiency = encodeURIComponent(deviceFromCsv.climate_efficiency || '');
                deviceData.resource_efficiency = encodeURIComponent(deviceFromCsv.resource_efficiency || '');
                
                // Create a new device document using the model
                const device = new Device(deviceData);
                const savedDevice = await device.save();
                console.log('Device data saved successfully with ID:', savedDevice._id);

                const ecoRating = parseInt(deviceFromCsv.eco_rating, 10);
                // Construct the query parameters to send the device information
                const queryParams = new URLSearchParams({
                    eco_rating: encodeURIComponent(deviceFromCsv.eco_rating || ''),
                    durability: encodeURIComponent(deviceFromCsv.durability || ''),
                    repairability: encodeURIComponent(deviceFromCsv.repairability || ''),
                    recyclability: encodeURIComponent(deviceFromCsv.recyclability || ''),
                    climate_efficiency: encodeURIComponent(deviceFromCsv.climate_efficiency || ''),
                    resource_efficiency: encodeURIComponent(deviceFromCsv.resource_efficiency || ''),
                    element_ID_MongoDB: savedDevice._id,
                }).toString();
                
                if (ecoRating > threshold) {
                    return res.redirect(`/score_OK_IHM.html?${queryParams}`);
                } else {
                    return res.redirect(`/score_ameliorable_IHM.html?${queryParams}`);
                }
            } else {
                return res.redirect('/score_inconnu_IHM.html');
            }
        }

    } catch (err) {
        console.error('Error processing request:', err);
        // Ensure only one response is sent
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

app.get('/check-onbase/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const device = await Device.findById(id);
        if (device) {
            res.json({ onBase: device.onBase });
        } else {
            res.status(404).json({ error: 'Device not found' });
        }
    } catch (error) {
        console.error('Error checking onBase:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Serve the different HTML pages based on the redirects
app.get('/score_OK_IHM.html', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', './pages/score_OK/score_OK_IHM.html'));
});

app.get('/score_ameliorable_IHM.html', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', './pages/score_ameliorable/score_ameliorable_IHM.html'));
});

app.get('/score_inconnu_IHM.html', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', './pages/score_inconnu/score_inconnu_IHM.html'));
});

app.get('/labels_verts_IHM.html', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', './pages/labels_verts/labels_verts_IHM.html'));
});

app.get('/information_IHM.html', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', './pages/information/information_IHM.html'));
});

app.get('/score_OK_details_IHM.html', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', './pages/score_OK_details/score_OK_details_IHM.html'));
});

app.get('/score_ameliorable_details_IHM.html', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', './pages/score_ameliorable_details/score_ameliorable_details_IHM.html'));
});

start();
