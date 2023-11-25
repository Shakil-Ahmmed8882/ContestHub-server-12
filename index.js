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
    app.get('/contests',async(req,res)=> {
      const {type} = req.query
      const result = await contestCollection.find({type:type}).toArray()
      res.send(result)
    })

    // get single by id
    app.get('/contest/', async (req, res) => {
      try {
        const { id } = req.query;
    
        if (!id) {
          return res.status(400).send('Contest ID is required');
        }
    
        const result = await contestCollection.findOne({ _id: new ObjectId(id) });
    
        if (!result || !result.winnerID || result.winnerID.length === 0) {
          return res.status(404).send('No contest found or no winner IDs available');
        }
    
        const winnersIds = result?.winnerID?.map(id => new ObjectId(id));
    
        const foundDocuments = await userCollection.find({ _id: { $in: winnersIds } }).toArray();
    
        if (!foundDocuments || foundDocuments.length === 0) {
          return res.status(404).send('No matching users found');
        }
    
        return res.send({contest:result,winners:foundDocuments});
      } catch (error) {
        console.error('Error:', error);
        return res.status(500).send('Internal Server Error');
      }
    });

    












    // ================== post api ==================
    //user
    app.post('/createUser',async(req,res)=> {
      const {email} = req.query
      const user = req.body
      
      const isUserExist = await userCollection.findOne({email:email})
      if(isUserExist) return 

      const result = await userCollection.insertOne(user)
      res.send(result)
    })


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
    app.patch('/participateContest', async (req, res) => {

        const { id } = req.body;
        const existingContest = await contestCollection.findOne({_id:new ObjectId(id)})
        const result = await contestCollection.updateOne(
          { _id: new ObjectId(id)},
          { $set: { participants: parseInt(existingContest?.participants) + 1} }
        );
    
      res.send(result)
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
