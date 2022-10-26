import express from "express";
import {  MongoClient } from "mongodb";
import Cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import http from "http";

dotenv.config();
let collections={};
let changeBattles;
const PORT = process.env.PORT || 5000;
const MONGO_URL=process.env.MONGO_URL;
const app = express();
app.use(express.json());
const server = http.createServer(app);
const corsOptions = {
  origin: "*",
  optionsSuccessStatus: 200,
};

const mongoClient = new MongoClient(MONGO_URL);
  
export const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST","PUT","DELETE"],
      "allowHeaders":[],
      "credentials":true

    },
  })
  
  
app.use(Cors(corsOptions));

server.listen(PORT,async ()=>{
  try{
    await mongoClient.connect();
    collections.pokemon=mongoClient.db("game").collection("pokemon");
    collections.battles=mongoClient.db("game").collection("battle");
    changeBattles=collections.battles.watch([
      {
        "$match":{
          "operationType":"update"
        }
      }
    ],{"fullDocument": "updateLookup"})
    console.log("listerning at *::",PORT)
  }catch(er){
    console.error(er);
  }
})


io.on("connection",(socket)=>{
  console.log("A client has connected!");
  changeBattles.on("change",(next)=>
  {
    io.to(socket.activeRoom).emit("refresh",next.fullDocument);
  })
  socket.on("join",async(battleId)=>{
    try{
      let result= await collections.battles.findOne({"_id":battleId});
      if(result){
        socket.emit("refresh",result);
      }else{
        let data={
          "_id":battleId,
          "playerOne":{
            "pokemon":{}
          },
          "playerTwo":{
            "pokemon":{}
          }
        }
        let newBattle = await collections.battles.insertOne(data)
        socket.emit("refresh",data);
      }
      socket.join(battleId);
      socket.activeRoom = battleId;

    }catch(ex){
      console.error(ex);
    }
  })
  socket.on("select",async (player,pokemon)=>{
    try{
      if(player==1){
        await collections.battles.updateOne({
          "_id":socket.activeRoom
        },
        {
          "$set":{
            "playerOne":{
              "pokemon":pokemon
            }
          }
        })
      }
      else{
        await collections.battles.updateOne({
          "_id":socket.activeRoom
        },
        {
          "$set":{
            "playerTwo":{
              "pokemon":pokemon
            }
          }
        })
      }
    }catch(ex){
      console.error(ex);
    }

  })
  socket.on("attack",async(player,move)=>{
    try{
      if(player==1){
        await collections.battles.updateOne(
          {
            "_id":socket.activeRoom
          },
          {
            "$inc":{
              "playerOne.pokemon.pp":-move.pp,
              "playerTwo.pokemon.hp":-move.damage
            }
          }
        )
      }else{
        await collections.battles.updateOne(
          {
            "_id":socket.activeRoom
          },
          {
            "$inc":{
              "playerTwo.pokemon.pp":-move.pp,
              "playerOne.pokemon.hp":-move.damage
            }
          }
        )

      }

    }catch(ex){
      console.error(ex);
    }
  })
})



app.post("/pokemon", async function (request, response) {
  try{

    const data = request.body;
    //db.movies.insertMany(data);
    const result = await collections.pokemon.insertMany(data);
    response.send(result);
  }catch(er){
    response.status(500).send({"message":er.message});
  }
});

app.get("/pokemon", async function (request, response) {
  try{
  //db.movies.insertMany(data);
  const result = await collections.pokemon.find({}).toArray();
  response.send(result);
}catch(er){
  response.status(500).send({"message":er.message});
}
});
app.post("/battles", async function (request, response) {
  try{

    const data = request.body;
    //db.movies.insertMany(data);
    const result = await collections.battles.insertOne(data);
    response.send(result);
  }catch(er){
    response.status(500).send({"message":er.message});
  }
});
app.get("/battles", async function (request, response) {
  try{
  //db.movies.insertMany(data);
  const result = await collections.battles.find({}).toArray();
  response.send(result);
}catch(er){
  response.status(500).send({"message":er.message});
}
});

app.get("/", (req, res) => {
  res.send("Welcome to Pokemon battle Application");
});
