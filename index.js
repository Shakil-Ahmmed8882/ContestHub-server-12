const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const jwt = require('jsonwebtoken');
// const stripe = require('stripe')(process.env.VITE_STRIPE_SECRET_KEY);
require("dotenv").config();


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





    /* ====================================
              JWT API
     ====================================*/
     // jwt related api
     app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })





    /* ====================================
              GET METHOD
     ====================================*/
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

        if (result) {
          const winnersIds = result?.winnerID?.map((id) => new ObjectId(id));

          if (winnersIds) {
            const foundDocuments = await userCollection
              .find({ _id: { $in: winnersIds } })
              .toArray();

            //send the response  ===>
            return res.send({ contest: result, winners: foundDocuments });
          }
        }
      }
    });

    // get contests based on creator id
    app.get("/contests/:email", async (req, res) => {
      const { email } = req.params;

      if (email) {
        const creator = await userCollection.findOne({ email: email });

        if (creator) {
          const result = await contestCollection
            .find({ creatorID: new ObjectId(creator._id.toString()) })
            .toArray();
          console.log(result);
          res.send(result);
        } else {
          res.status(404).send({ message: "No data found" });
        }
      }
    });

    //  ============= user ===============
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      return res.send(result);
    });


    // participants
    app.get('/participants/:id',async(req,res)=>{
      // const {id} = req.params
      const contest = await contestCollection.findOne({_id:new ObjectId('65639c425031084f2d4ae08e')})

      const result = await userCollection.find({ email: { $in: contest.participants} }).toArray()

      console.log(result)
      res.send({contest,result})

      
    })
    /* ====================================
              POST METHOD
     ====================================*/
    //user
    app.post("/createUser", async (req, res) => {
      const { email } = req.query;
      const user = req.body;

      const isUserExist = await userCollection.findOne({ email: email });
      if (isUserExist) return;

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // create contest
    app.post("/creatContest", async (req, res) => {
      const { email } = req.query;
      const contestData = req.body;
      // get the contest creotof to store id
      const contestCreator = await userCollection.findOne({ email: email });
      contestData.creatorID = contestCreator?._id;

      // add to the database
      const result = await contestCollection.insertOne(contestData);
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

    /* ====================================
              PATCH METHOD
     ====================================*/
    // Increasing the new participant number
    app.post("/participateContest", async (req, res) => {
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
      const isContestExist = contestSubmittedUser.participationDetails.attemptedContests.includes(
          id
        );
       
      if (isContestExist) return res.send({ error: "Already participated " });

      console.log(isContestExist)
      // updating ateh attempted contest when user register for a contest
      const updatedDoc = {
        $push: {
          "participationDetails.attemptedContests": id,
        },
      };

      await userCollection.updateOne({ email: userEmail }, updatedDoc);

      // update the particpants count in specific contest

      const updatedContestParticipants = {
        $push: {
          participants: userEmail,
        },
      };
      const result = await contestCollection.updateOne(
        { _id: new ObjectId(id) },
        updatedContestParticipants
      );
      res.send(result);
    });

    // change role
    // Update the role for a specific user based on the received data
    app.patch("/role", async (req, res) => {
      const { role, userId } = req.body;

      // Check if role and userId are provided
      if (!role || !userId) {
        return res.status(400).json({ error: "Role and User ID are required" });
      }

      try {
        // Updating the role for the user with the given userId
        const result = await userCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { role: role } }
        );
        res.send(result);
      } catch (error) {
        console.error("Error updating role:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    });

    //contest
    app.patch("/contest", async (req, res) => {
      const { id } = req.query;

      const result = await contestCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "approved" } }
      );

      res.send(result);
    });

    /* ====================================
              DELETE METHOD
     ====================================*/
    //user
    app.delete("/user", async (req, res) => {
      const { id } = req.query;
      if (id) {
        const deleteUser = await userCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(deleteUser);
      }
    });

    // contest
    app.delete("/contest", async (req, res) => {
      const { id } = req.query;
      if (id) {
        const result = await contestCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      }
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
