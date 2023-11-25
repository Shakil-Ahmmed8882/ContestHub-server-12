const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
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
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sk8jxpx.mongodb.net/?retryWrites=true&w=majority`;

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
    app.get('/contest/',async(req,res)=> {
      const {id} = req.query
      const result = await contestCollection.findOne({_id:new ObjectId(id)})
      return res.send(result)
    })












    // ================== User post api ==================
    app.post('/createUser',async(req,res)=> {
      const {email} = req.query
      const user = req.body
      
      const isUserExist = await userCollection.findOne({email:email})
      if(isUserExist) return 

      const result = await userCollection.insertOne(user)
      res.send(result)
    })


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
