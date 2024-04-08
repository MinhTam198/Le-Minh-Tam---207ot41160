const express = require('express')
const app = express()
const port = 3000
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const path = require('path');
const multer = require('multer');
const fs = require('fs'); 

//mongodb server
const url = 'mongodb://localhost:27017'; 
const dbName = 'mydatabase';
const collectionName = 'watchs';

app.use(express.static(__dirname));
app.use(express.static('public'));
app.use(express.static('public/images'));
app.use(express.static('public/pages'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); 
app.use('/public', express.static(path.join(__dirname, 'public')));

//image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/') 
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname + '-' + Date.now() + '.jpg') 
    }
});

const upload = multer({ storage: storage });

///////////////////////////////////////////////////////////
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/pages/home.html');
});

app.get('/create', (req, res) => {
    res.sendFile(__dirname + '/public/pages/create.html');
});

app.post('/api/create', upload.array('images', 10), async (req, res) => {
    try {
        const client = new MongoClient(url);
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        let maxId = 0;
        const watchs = await collection.find().toArray();
        for (let i = 0; i < watchs.length; i++) {
            const currentId = parseInt(watchs[i].id.substring(5));
            if (currentId > maxId) {
                maxId = currentId;
            }
        }
        maxId++;

        const watchss = req.files.map(file => ({
            id: 'WATCH' + maxId.toString().padStart(4, '0'),
            name: req.body.name,
            brand: req.body.brand,
            price: req.body.price,
            size: req.body.size,
            image: file.filename
        }));

        const result = await collection.insertMany(watchss);

        console.log('Inserted count:', result.insertedCount);
        res.send('New watches added successfully!');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/list', async (req, res) => {
    let client;
    try {
        client = await MongoClient.connect(url); 
        console.log('Connected to MongoDB! ✅');

        const db = client.db(dbName);
        const watchsCollection = db.collection(collectionName);
        
        const query = {};

        const watchs = await watchsCollection.find(query).toArray();

        let tableHtml = fs.readFileSync(path.join(__dirname, '/public/pages/read.html'), 'utf8');

        let dataRows = '';
        watchs.forEach((watch) => {
            dataRows += `<tr>
                            <td>${watch.id}</td>
                            <td>${watch.name}</td>
                            <td>${watch.brand}</td>
                            <td>${watch.size}</td>
                            <td>${watch.price}</td>
                            <td><img src="${watch.image}" width="100" /></td>
                        </tr>`;
        });

        tableHtml = tableHtml.replace('<!-- Data will be dynamically inserted here -->', dataRows);

        res.send(tableHtml);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    } finally {
        if (client) {
            await client.close();
            console.log('MongoDB connection closed! ❌');
        }
    }
});

let client;
app.get('/api/search', async (req, res) => {
    try {
        if (!client) {
            client = new MongoClient(url);
            await client.connect();
        }

        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        const query = {};

        if (req.query.name) {
            query.name = { $regex: req.query.name, $options: 'i' };
        }
        if (req.query.brand) {
            query.brand = { $regex: req.query.brand, $options: 'i' };
        }
        if (req.query.minPrice && req.query.maxPrice) {
            query.price = { $gte: parseInt(req.query.minPrice), $lte: parseInt(req.query.maxPrice) };
        }
        if (req.query.size) {
            query.size = { $regex: req.query.size, $options: 'i' };
        }

        const watches = await collection.find(query).toArray();

        res.send(watches);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.listen(port, () => console.log(`🚀 on port ${port}!`))