const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const jwt = require("jsonwebtoken");
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
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    //Verify token
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Verifying admin here
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    /* ====================================
              GET METHOD
     ====================================*/

    // Checking admin role
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email; // Accessing the 'email' parameter correctly
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user?.role === "admin";
      res.send({ isAdmin });
    });
    // Checking creator role
    app.get("/users/creator/:email", async (req, res) => {
      const email = req.params.email; // Accessing the 'email' parameter correctly
      const user = await userCollection.findOne({ email: email });

      const isCreator = user?.role === "contest_creator";
      res.send({ isCreator });
    });
    //======== Contest ==============
    //get all by type
    app.get("/contests", async (req, res) => {
      const { type } = req.query;

      let query = {};

      if (type === "All" || !type) {
        query = {};
      }

      if (type && type !== "All") {
        query = { type: type };
        console.log(`Loading data for type: ${type}`);
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

        // if (result) {
        //   const winnersIds = result?.winnerID?.map((id) => new ObjectId(id));

        //   if (winnersIds) {
        //     const foundDocuments = await userCollection
        //       .find({ _id: { $in: winnersIds } })
        //       .toArray();

        //     //send the response  ===>
        //   }
        // }
        return res.send({ contest: result });
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
    app.get("/participants/:id", async (req, res) => {
      const id = req.params.id;
      const contest = await contestCollection.findOne({
        _id: new ObjectId(id),
      });

      const result = await userCollection
        .find({ email: { $in: contest.participants } })
        .toArray();
      res.send({ contest, result });
    });

    // get the user participated contests after the payment
    // app.get("/user/participatedContests/:email", async (req, res) => {
    //   try {
    //     const email = req.params.email;
    //     const user = await userCollection.findOne({ email: email });

    //     if (!user) {
    //       return res.status(404).json({ error: "User not found" });
    //     }

    //     const attemptedContestsIds = user.participationDetails.attemptedContests || [];

    //     const result = await contestCollection.find().toArray();

    //     // Filter contests whose IDs are in attemptedContestsIds
    //     const filteredContests = result.filter(contest => attemptedContestsIds.includes(contest._id.toString()));

    //     res.json({ user, attemptedContests: filteredContests });
    //   } catch (err) {
    //     console.error("Error:", err);
    //     res.status(500).json({ error: "Internal server error" });
    //   }
    // });
    // get registered contests
    app.get("/user/participatedContests/:email/:winning", async (req, res) => {
      try {
        const email = req.params.email;
        const typeWinning = req.params.winning;

        const user = await userCollection.findOne({ email: email });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // find the specific user wining contest
        if (typeWinning == "winning") {
          const winingContestIds = user.participationDetails.wonContests || [];
          const result = await contestCollection.find().toArray();

          // Filter contests whose IDs are in attemptedContestsIds
          const winingContest = result.filter((contest) =>
            winingContestIds.includes(contest._id.toString())
          );
          // if no winning contest
          if (!winingContest) return res.send({ error: "no data found" });
          // else send the wining data found
          return res.send(winingContest);
        }

        const attemptedContestsIds = user.registeredContests || [];

        const result = await contestCollection.find().toArray();

        // Filter contests whose IDs are in attemptedContestsIds
        const filteredContests = result.filter((contest) =>
          attemptedContestsIds.includes(contest._id.toString())
        );

        res.json({ attemptedContests: filteredContests });
      } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Get top 6 participated contests
    app.get("/topParticipatedContests", async (req, res) => {
      try {
        const topParticipatedContests = await contestCollection
          .aggregate([
            // Filtering contests with participants
            { $match: { participants: { $exists: true, $ne: [] } } },
            {
              $project: {
                contestName: 1,
                image: 1,
                description: 1,
                prizeMoney: 1,
                taskSubmissionInstructions: 1,
                tags: 1,
                deadline: 1,
                status: 1,
                winnerID: 1,
                type: 1,
                creatorID: 1,
                // Computing participants count
                participantsCount: { $size: "$participants" },
              },
            },
            // Sorting by participant count in descending order
            { $sort: { participantsCount: -1 } },
            // Limiting to top 6 contests
            { $limit: 6 },
          ])
          .toArray();

        res.json(topParticipatedContests);
      } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // get contest by tags as search reasult
    // search contests by tags
    app.get("/searchContestsByTag", async (req, res) => {
      try {
        const searchQuery = req.query.searchQuery;
        console.log(searchQuery);

        if (!searchQuery || searchQuery.trim() === "") {
          return res
            .status(400)
            .json({ error: "Search query is missing or empty." });
        }

        // Perform a case-insensitive search on tags field
        const searchResults = await contestCollection
          .find({ tags: { $regex: searchQuery, $options: "i" } })
          .toArray();

        res.send(searchResults);
      } catch (err) {
        console.error("Error:", err);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    // get all the contest creators
    app.get("/allContestCreators", async (req, res) => {
      const result = await userCollection
        .find({ role: "contest_creator" })
        .toArray();
      res.send(result);
    });

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

    app.post("/participateContest", async (req, res) => {
      const { id, userEmail } = req.body;

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

      if (isContestExist) return res.send({ error: "Already participated " });

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
    // Increasing the new participant number after the payment

    // store the registered contests
    app.post("/registeredContest", async (req, res) => {
      const { id, userEmail } = req.body;

      const existingContest = await contestCollection.findOne({
        _id: new ObjectId(id),
      });

      const registeredUser = await userCollection.findOne({
        email: userEmail,
      });

      // If there is no user found, return
      if (!registeredUser) return;

      // If the user has already registered the contest, return
      const isContestExist = registeredUser?.registeredContests?.includes(id);

      if (isContestExist) return res.send({ error: "Already participated " });

      // updating ateh attempted contest when user register for a contest
      const updatedDoc = {
        $push: {
          registeredContests: id,
        },
      };

      const result = await userCollection.updateOne(
        { email: userEmail },
        updatedDoc
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

    // find the best contest creators
    app.patch("/bestContestCreator/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const rating = parseInt(req.body.newValue);

        //getting the creator
        const creator = await userCollection.findOne({ email: email });

        // responsd error if no creator found
        if (!creator) {
          return res.status(404).send({ error: "No user found" });
        }

        // generate the schema for the doc to be updated
        const updatedDoc = {
          $set: {
            bestCreatorRating: rating,
          },
        };

        const updateResult = await userCollection.updateOne(
          { email: email },
          updatedDoc
        );
        res.send(updateResult);
      } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    // Start the server
    const PORT = 3000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
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
