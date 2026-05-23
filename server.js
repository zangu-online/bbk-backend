```js
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ====================================
// FIREBASE ADMIN
// ====================================

const serviceAccount = JSON.parse(
process.env.FIREBASE_SERVICE_ACCOUNT
);

admin.initializeApp({
credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ====================================
// GET PESAPAL TOKEN
// ====================================

async function getToken(){

try{

const response = await axios.post(
"https://pay.pesapal.com/v3/api/Auth/RequestToken",
{
consumer_key:
process.env.PESAPAL_CONSUMER_KEY,

consumer_secret:
process.env.PESAPAL_CONSUMER_SECRET
}
);

if(!response.data.token){
throw new Error("Failed to get token");
}

return response.data.token;

}catch(error){

console.log(
error.response?.data || error.message
);

throw error;

}

}

// ====================================
// CREATE PAYMENT ORDER
// ====================================

app.post("/create-order", async(req,res)=>{

try{

const token = await getToken();

const order = {

id: "BBK_" + Date.now(),

currency: "KES",

amount: req.body.amount,

description: "BBK Deposit",

callback_url:
"https://boostyabankkenya.web.app/dashboard.html",

notification_id:
process.env.PESAPAL_IPN_ID,

billing_address:{

email_address: req.body.email,

phone_number: "254700000000",

country_code: "KE",

first_name: "BBK",

last_name: "USER"

}

};

const response = await axios.post(

"https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest",

order,

{
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
}
}

);

res.json(response.data);

}catch(error){

console.log(
error.response?.data || error.message
);

res.status(500).json({
success:false,
message:"Payment failed"
});

}

});

// ====================================
// PESAPAL IPN CALLBACK
// ====================================

app.post("/ipn", async (req, res) => {

try {

const data = req.body;

console.log("IPN:", data);

const status = data?.payment_status;

const amount =
Number(data?.amount || 0);

const userId =
data?.reference || "unknown";

if(status === "COMPLETED"){

const userRef =
db.collection("users").doc(userId);

const doc = await userRef.get();

let balance = 0;

if(doc.exists){
balance = doc.data().balance || 0;
}

await userRef.set({
balance: balance + amount
}, { merge: true });

await db.collection("transactions").add({
userId,
amount,
status:"success",
createdAt:new Date()
});

}

res.sendStatus(200);

}catch(err){

console.log(err);

res.sendStatus(500);

}

});

// ====================================
// TEST ROUTE
// ====================================

app.get("/", (req,res)=>{

res.send("BBK Pesapal Backend Running");

});

// ====================================
// START SERVER
// ====================================

app.listen(PORT, ()=>{

console.log(
"Server running on port " + PORT
);

});
```
