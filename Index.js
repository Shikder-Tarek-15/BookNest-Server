const express = require("express");
const cors = require("cors");
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');

//middleware
app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.rtcbpiy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
console.log(uri); 
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const database = client.db("BookNest");
const roomCollection = database.collection("roomCollection");

async function run() {
  try {
    
   
    app.get("/allRooms", async(req, res)=>{
        const cursor = roomCollection.find();
        const result = await cursor.toArray();
        res.send(result)
    })

    app.post("/filteredRooms", async(req,res)=>{
      const data = req.body;
      const {start, end} = data;
      const rooms = roomCollection.find({pricePerNight: {$gte: start, $lte: end}});
      const result = await rooms.toArray()
      console.log(data);
      res.send(result)
    })



    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





app.get("/", (req, res) => {
  res.send("Booknest server is running");
});
app.listen(port, () => {
  console.log("Server running on port: ", port);
});
