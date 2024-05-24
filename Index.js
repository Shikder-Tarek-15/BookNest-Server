const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
require('dotenv').config()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser())

// Middlewares
const logger = async(req, res, next)=>{
  console.log('called: ', req.host, req.originalUrl);
  next()
}

const verifyToken = async(req,res, next)=>{
  const token = req.cookies?.token;
  console.log('value of token in middleware: ', token);
  if(!token){
      return res.status(401).send({message: 'not authorized'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
      // error
      if(err){
          return res.status(401).send({message: 'unauthorized'})
      }
      console.log('value in token: ', decoded)
      req.user = decoded
      next()

  })
}


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
const bookingCollection = database.collection("bookingCollection")

async function run() {
  try {


     // Auth related api
     app.post('/jwt', async(req,res)=>{
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h'})
      res
      .cookie('token', token, {
          httpOnly: true,
          secure: false,
      })
      .send({success: true})
  })
    
   
    app.get("/availableRooms", async(req, res)=>{
      const query = {availability: true}
        const cursor = roomCollection.find(query);
        const result = await cursor.toArray();
        res.send(result)
    })

    app.get("/roomDetails/:id", async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await roomCollection.findOne(query);
      res.send(result)
    })

    app.get("/filteredRooms", async(req,res)=>{
      const data = req.body;
      const {start, end} = data;
      const rooms = roomCollection.find({pricePerNight: {$gte: start, $lte: end}});
      const result = await rooms.toArray()
      res.send(result)
    })

    app.get('/myBookings/:email', async(req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/checkBooked', async(req,res)=>{
      const {roomId} = req.body;
      console.log(roomId);
      const query = {roomId: roomId}
      const result = await bookingCollection.find(query).toArray()
      console.log("this is:" ,result)
      res.send(result)
    })



    app.post("/bookingCollection", async(req,res)=>{
      const data = req.body;
      console.log(data.roomId);
      const booked = await bookingCollection.findOne({roomId: data.roomId})
      if(booked){
        return res.send("This room already booked")
      }
      const result = await bookingCollection.insertOne(data);
      res.send(result)
    })




    app.post("/roomReview", verifyToken, async (req, res) => {
      const { roomId, review, rating } = req.body;
      const userId = req.user._id;

      // Check if the user has booked the room
      const room = await roomCollection.findOne({ _id: new ObjectId(roomId), bookedBy: userId });

      if (!room) {
        return res.status(403).send({ message: 'You can only review rooms you have booked.' });
      }

      // Add review to the room
      const result = await roomCollection.updateOne(
        { _id: new ObjectId(roomId) },
        { $push: { reviews: { userId, review, rating, date: new Date() } } }
      );

      if (result.modifiedCount > 0) {
        res.send({ success: true, message: 'Review submitted successfully.' });
      } else {
        res.status(500).send({ message: 'Failed to submit review.' });
      }
    });

    app.post('/logOut', logger, async(req, res)=>{
      const user = req.body;
      console.log("logging out", user);
      res.clearCookie('token', {maxAge: 0}).send({success: true})
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
