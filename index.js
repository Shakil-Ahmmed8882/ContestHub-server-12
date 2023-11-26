const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
// const stripe = require('stripe')(process.env.VITE_STRIPE_SECRET_KEY);
require("dotenv").config();

// var jwt = require("jsonwebtoken");
// Middle ware
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);

// MONGODB CONNECTION
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sk8jxpx.mongodb.net/?retryWrites=true&w=majority`;
const uri = `mongodb://0.0.0.0:27017`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // create database here
    const contestCollection = client.db("ContestCraft").collection("contests");
    const userCollection = client.db("ContestCraft").collection("users");

    //======== Contest ==============
    //get all by type
    app.get("/contests", async (req, res) => {
      const { type } = req.query;

      let query = {};

      if (type) {
        query = { type: type };
      }
      const result = await contestCollection.find(query).toArray();
      res.send(result);
    });

    // get single by id
    app.get("/contest/", async (req, res) => {
      const { id } = req.query;

      if (id) {
        const result = await contestCollection.findOne({
          _id: new ObjectId(id),
        });

        const winnersIds = result?.winnerID?.map((id) => new ObjectId(id));
        if (winnersIds) {
          const foundDocuments = await userCollection
            .find({ _id: { $in: winnersIds } })
            .toArray();

          //send the response  ===>
          return res.send({ contest: result, winners: foundDocuments });
        }
      }
    });

    //  ============= user ===============
    app.get("/users", async (req, res) => {
      const result = await contestCollection.find().toArray();
      return res.send(result);
    });

    // ================== post api ==================
    //user
    app.post("/createUser", async (req, res) => {
      const { email } = req.query;
      const user = req.body;

      const isUserExist = await userCollection.findOne({ email: email });
      if (isUserExist) return;

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // =========== payment ==========
    // // payment intent
    // app.post("/create-payment-intent", async (req, res) => {
    //   const { prizeMoney } = req.body;
    //   const IntPrice = parseInt(prizeMoney)
    //   const amount = IntPrice * 100

    //   console.log('sent cart amount',amount)
    //   // return
    //   const paymentIntent = await stripe.paymentIntents.create({
    //     amount:amount,
    //     currency:'usd',
    //     payment_method_types:['card']
    //   })

    //   res.send({
    //     clientSecret:paymentIntent.client_secret
    //   })
    // })

    // ================== Patch method ==================
    // Increasing the new participant number
    app.patch("/participateContest", async (req, res) => {
      const { id, userEmail } = req.body;
      const existingContest = await contestCollection.findOne({
        _id: new ObjectId(id),
      });

      const contestSubmittedUser = await userCollection.findOne({
        email: userEmail,
      });

      // If there is no user found, return
      if (!contestSubmittedUser) return;

      // If the user has already registered the contest, return
      const isContestExist =
        contestSubmittedUser.participationDetails.attemptedContests.includes(
          id
        );
      if (isContestExist) return res.send({ error: "Already reagistered " });

      // updating ateh attempted contest when user register for a contest
      const updatedDoc = {
        $push: {
          "participationDetails.attemptedContests": id,
        },
      };

      await userCollection.updateOne({ email: userEmail }, updatedDoc);

      // update the particpants count in specific contest
      const result = await contestCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { participants: parseInt(existingContest?.participants) + 1 } }
      );
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
  res.send("ContestCraft is running");
});

app.listen(port, () => {
  console.log(`ContestCraft is running on port ${port}`);
});
