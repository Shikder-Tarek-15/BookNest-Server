const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Middlewares
const logger = async (req, res, next) => {
  console.log("called: ", req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log("value of token in middleware: ", token);
  if (!token) {
    return res.status(401).send({ message: "not authorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error
    if (err) {
      return res.status(401).send({ message: "unauthorized" });
    }
    console.log("value in token: ", decoded);
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.rtcbpiy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
console.log(uri);
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const database = client.db("BookNest");
const roomCollection = database.collection("roomCollection");
const bookingCollection = database.collection("bookingCollection");
const reviewCollection = database.collection("reviewCollection");

async function run() {
  try {
    // Auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });

    app.get("/rooms", async (req, res) => {
      const cursor = roomCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/availableRooms", async (req, res) => {
      const query = { availability: true };
      const cursor = roomCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/roomDetails/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomCollection.findOne(query);
      res.send(result);
    });

    app.get("/filteredRooms", async (req, res) => {
      const data = req.body;
      const { start, end } = data;
      const rooms = roomCollection.find({
        pricePerNight: { $gte: start, $lte: end },
      });
      const result = await rooms.toArray();
      res.send(result);
    });

    app.get("/review", async (req, res) => {
      const data = await reviewCollection
        .find()
        .sort({ submitTime: -1 })
        .toArray();
      res.send(data);
    });

    app.get("/myBookings/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/checkBooked", async (req, res) => {
      const { roomId } = req.body;
      console.log(roomId);
      const query = { roomId: roomId };
      const result = await bookingCollection.find(query).toArray();
      console.log("this is:", result);
      res.send(result);
    });
    app.patch("/book/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          availability: false,
        },
      };
      const result = await roomCollection.updateOne(query, update);
      res.send(result);
    });

    app.post("/bookingCollection", verifyToken, async (req, res) => {
      const data = req.body;
      console.log(data);
      const booked = await bookingCollection.findOne({ roomId: data.roomId });
      if (booked) {
        return res.send("This room already booked");
      }
      const result = await bookingCollection.insertOne(data);
      res.send(result);
    });

    app.post("/logOut", logger, verifyToken, async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    app.post("/reviewCenter", async (req, res) => {
      const data = req.body;
      const result = await reviewCollection.insertOne(data);
      res.send(result);
    });

    app.patch("/updateBooking", async (req, res) => {
      const { userEmail, roomId, start, end } = req.body;
      const query = { userEmail: userEmail, _id: new ObjectId(roomId) };
      const update = {
        $set: {
          start: start,
          end: end,
        },
      };
      const result = await bookingCollection.updateOne(query, update);
      res.send(result);
    });

    app.patch("/submitReview", verifyToken, async (req, res) => {
      const data = req.body;
      const { id, name, profile, rating, comment, submitTime } = data;
      const query = { _id: new ObjectId(id) };
      console.log("This is review: ", query);
      const updateReview = {
        $push: {
          reviews: {
            name: name,
            profile: profile,
            rating: rating,
            comment: comment,
            submitTime: submitTime,
          },
        },
      };
      // const result1 = await reviewCollection.insertOne(data);
      const result = await roomCollection.updateOne(query, updateReview);
      res.send(result);
      // res.send(result1);
    });

    app.patch("/updateRoomAvailability", async (req, res) => {
      try {
        const now = new Date();

        const roomsToUpdate = await bookingCollection.find({
          end: { $lt: now },
        });

        await Promise.all(
          roomsToUpdate.map((room) =>
            roomCollection.updateOne(
              { _id: room._id },
              { $set: { availability: true } }
            )
          )
        );

        res
          .status(200)
          .json({ message: "Room availability updated successfully." });
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to update room availability." });
      }
    });

    // delete
    app.delete("/deleteBooking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/deleteBook/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(query);
      const update = {
        $set: {
          availability: true,
        },
      };
      const result = await roomCollection.updateOne(query, update);
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Booknest server is running");
});
app.listen(port, () => {
  console.log("Server running on port: ", port);
});
